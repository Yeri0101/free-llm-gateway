import { Hono } from 'hono';
import { supabase } from '../db';
import { gatewayAuth } from '../middleware/gatewayAuth';
import { providerStates, updateProviderCalls, markProviderError, checkAndRecoverProvider } from '../utils/limitTracker';

type Variables = {
    gatewayKey: any;
};

const v1 = new Hono<{ Variables: Variables }>();

v1.use('*', gatewayAuth);

// In-memory counter for round-robin load balancing
const modelCounters: Record<string, number> = {};

v1.post('/chat/completions', async (c) => {
    const gatewayKey = c.get('gatewayKey');
    const allowedModels = gatewayKey.gateway_key_models || [];

    try {
        const body = await c.req.json();
        const requestedModel = body.model;

        // Check if the gateway key is allowed to use this model
        const allowed = allowedModels.filter((m: any) => m.model_name === requestedModel);

        if (allowed.length === 0) {
            return c.json({ error: { message: `Model ${requestedModel} is not available for this API key.`, type: "invalid_request_error" } }, 403);
        }

        // Filter out keys marked as error or rate_limited from our tracker
        // Using checkAndRecoverProvider allows keys to be retried after their timeout
        const healthyAllowed = allowed.filter((m: any) => {
            return checkAndRecoverProvider(m.upstream_key_id) === 'healthy';
        });

        // Fallback to all mapping if everything is rate_limited (at least let them hit the API to see the error)
        let candidates = healthyAllowed.length > 0 ? healthyAllowed : allowed;

        if (candidates.length === 0) {
            return c.json({ error: { message: `Model ${requestedModel} is not available.`, type: "invalid_request_error" } }, 403);
        }

        // Round-robin load balancing logic
        const counterKey = `${gatewayKey.id}:${requestedModel}`;
        if (typeof modelCounters[counterKey] === 'undefined') {
            modelCounters[counterKey] = 0;
        }

        const startTime = Date.now();
        let finalResponse: any = null;
        let finalStatus = 500;
        let finalTokens = 0;
        let usedUpstreamKeyId: string | null = null;
        let usedProvider: string | null = null;
        let finalErrorMsg: string | null = null;
        let finalErrorData: any = null;

        // Fallback Loop
        for (let attempt = 0; attempt < candidates.length; attempt++) {
            // Select the next upstream key and increment the counter
            const selectedIndex = modelCounters[counterKey] % candidates.length;
            const selectedMapping = candidates[selectedIndex];
            modelCounters[counterKey]++; // increment for next time

            usedUpstreamKeyId = selectedMapping.upstream_key_id;

            const { data: upstream, error } = await supabase
                .from('upstream_keys')
                .select('*')
                .eq('id', selectedMapping.upstream_key_id)
                .single();

            if (error || !upstream) {
                console.error(`Upstream provider not found or misconfigured for id: ${selectedMapping.upstream_key_id}`);
                continue; // Try next
            }

            usedProvider = upstream.provider;
            console.log(`[Load Balancer] Attempt ${attempt + 1}: Using upstream key ${upstream.id} for model ${requestedModel} (Index: ${selectedIndex}, Total Options: ${candidates.length})`);

            // Determine the base URL based on provider
            let baseUrl = '';
            if (upstream.provider === 'openai') baseUrl = 'https://api.openai.com/v1/chat/completions';
            else if (upstream.provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
            else if (upstream.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
            else if (upstream.provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

            if (!baseUrl) {
                console.error(`Unknown provider ${upstream.provider}`);
                continue; // Try next
            }

            try {
                // Forward the exact body to the upstream
                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${upstream.api_key}`,
                        // If OpenRouter, add required headers (can be configurable later)
                        ...(upstream.provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'OpenClaw Gateway' } : {})
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const isRateLimit = response.status === 429;
                    const errMsg = errData.error?.message || response.statusText;
                    markProviderError(upstream.id, isRateLimit ? 'rate_limited' : 'error', errMsg);

                    finalStatus = response.status;
                    finalErrorMsg = errMsg;
                    finalErrorData = errData;
                    console.error(`[Fallback] API request failed with ${response.status}: ${errMsg}`);

                    if (isRateLimit || response.status >= 500) {
                        continue; // try next candidate if rate limited or server error
                    } else {
                        // Bad request, no need to fallback, return right away
                        break;
                    }
                }

                // Handle streaming
                if (body.stream && response.body) {
                    finalStatus = 200;
                    finalTokens = 500; // Approximation for streaming 
                    updateProviderCalls(upstream.id, finalTokens);

                    // Log to supabase asynchronously
                    const latencyMs = Date.now() - startTime;
                    supabase.from('request_logs').insert([{
                        project_id: gatewayKey.project_id,
                        gateway_key_id: gatewayKey.id,
                        upstream_key_id: usedUpstreamKeyId,
                        provider: usedProvider,
                        model: requestedModel,
                        status_code: finalStatus,
                        latency_ms: latencyMs,
                        total_tokens: finalTokens
                    }]).then(({ error: logErr }) => {
                        if (logErr) console.error("Logging failed:", logErr);
                    });

                    c.header('Content-Type', 'text/event-stream');
                    c.header('Cache-Control', 'no-cache');
                    c.header('Connection', 'keep-alive');
                    return c.body(response.body);
                }

                // Handle non-streaming
                const data = await response.json();
                finalStatus = 200;
                finalTokens = data.usage?.total_tokens || 0;
                updateProviderCalls(upstream.id, finalTokens);

                // Inject metadata for debugging and verifying rotation
                data._openclaw_metadata = {
                    provider: upstream.provider,
                    upstream_key_id: upstream.id
                };

                finalResponse = data;
                break; // success, break the loop

            } catch (fetchErr: any) {
                finalStatus = 500;
                finalErrorMsg = fetchErr.message;
                console.error(`[Fallback] Fetch error: ${fetchErr.message}`);
                markProviderError(upstream.id, 'error', fetchErr.message);
                continue; // connection error, try next
            }
        } // end fallback loop

        // Log the final outcome
        const latencyMs = Date.now() - startTime;
        supabase.from('request_logs').insert([{
            project_id: gatewayKey.project_id,
            gateway_key_id: gatewayKey.id,
            upstream_key_id: usedUpstreamKeyId,
            provider: usedProvider,
            model: requestedModel,
            status_code: finalStatus,
            latency_ms: latencyMs,
            total_tokens: finalTokens,
            error_message: finalErrorMsg
        }]).then(({ error: logErr }) => {
            if (logErr) console.error("Logging failed:", logErr);
        });

        if (finalResponse) {
            return c.json(finalResponse, finalStatus as any);
        } else {
            const errRes = finalErrorData && finalErrorData.error ? finalErrorData : { error: { message: finalErrorMsg || "All upstream candidates failed", type: "api_error" } };
            errRes._openclaw_metadata = {
                provider: usedProvider,
                upstream_key_id: usedUpstreamKeyId
            };
            return c.json(errRes, finalStatus as any);
        }

    } catch (err: any) {
        return c.json({ error: { message: err.message, type: "internal_server_error" } }, 500);
    }
});

export default v1;
