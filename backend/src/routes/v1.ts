import { Hono } from 'hono';
import { stream } from 'hono/streaming';
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
        // Debug: dump body structure to file to diagnose 400 errors
        try {
            const { writeFileSync } = await import('fs');
            writeFileSync('/tmp/openclaw-body.json', JSON.stringify({
                model: body.model, stream: body.stream, max_tokens: body.max_tokens,
                tool_choice: body.tool_choice, response_format: body.response_format,
                keys: Object.keys(body), tools_count: (body.tools || []).length,
                messages: body.messages?.map((m: any) => ({
                    role: m.role, has_tool_calls: !!(m.tool_calls?.length),
                    content_type: typeof m.content, content_len: (m.content || '').length
                }))
            }, null, 2));
        } catch (_) { }


        // Check if the gateway key is allowed to use this model
        const allowed = allowedModels.filter((m: any) => m.model_name === requestedModel);

        if (allowed.length === 0) {
            return c.json({ error: { message: `Model ${requestedModel} is not available for this API key.`, type: "invalid_request_error" } }, 403);
        }

        // Filter out keys marked as error or rate_limited from our tracker
        const healthyAllowed = allowed.filter((m: any) => {
            return checkAndRecoverProvider(m.upstream_key_id) === 'healthy';
        });

        // Fallback to all mappings if everything is unhealthy
        let candidates = healthyAllowed.length > 0 ? healthyAllowed : allowed;

        if (candidates.length === 0) {
            return c.json({ error: { message: `Model ${requestedModel} is not available.`, type: "invalid_request_error" } }, 403);
        }

        // Round-robin load balancing
        const counterKey = `${gatewayKey.id}:${requestedModel}`;
        if (typeof modelCounters[counterKey] === 'undefined') {
            modelCounters[counterKey] = 0;
        }

        // Diagnostic: log all configured keys and their health status for this model
        const ts0 = new Date().toISOString();
        console.log(`[${ts0}] [RoundRobin] model=${requestedModel} | DB keys for this gw-key: ${allowed.length} | Healthy: ${healthyAllowed.length} | Counter: ${modelCounters[counterKey]}`);
        allowed.forEach((m: any, i: number) => {
            const s = checkAndRecoverProvider(m.upstream_key_id);
            console.log(`[${ts0}]   slot[${i}] upstream_id=${m.upstream_key_id.substring(0, 8)}... health=${s} inCandidates=${candidates.some((c: any) => c.upstream_key_id === m.upstream_key_id)}`);
        });

        // Advance counter ONCE before the fallback loop so that failed retries
        // don't consume a rotation slot and skip a key on the next request.
        const startIndex = modelCounters[counterKey] % candidates.length;
        modelCounters[counterKey]++;

        const startTime = Date.now();
        let finalResponse: any = null;
        let finalStatus = 500;
        let finalTokens = 0;
        let usedUpstreamKeyId: string | null = null;
        let usedProvider: string | null = null;
        let finalErrorMsg: string | null = null;
        let finalErrorData: any = null;

        // Fallback Loop — starts at startIndex, wraps around through all candidates
        for (let attempt = 0; attempt < candidates.length; attempt++) {
            const selectedIndex = (startIndex + attempt) % candidates.length;
            const selectedMapping = candidates[selectedIndex];


            usedUpstreamKeyId = selectedMapping.upstream_key_id;

            const { data: upstream, error } = await supabase
                .from('upstream_keys')
                .select('*')
                .eq('id', selectedMapping.upstream_key_id)
                .single();

            if (error || !upstream) {
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] Upstream provider not found or misconfigured for id: ${selectedMapping.upstream_key_id}`);
                continue; // Try next
            }

            usedProvider = upstream.provider;
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [Load Balancer] Attempt ${attempt + 1}: Using upstream key ${upstream.id} for model ${requestedModel} (Index: ${selectedIndex}, Total Options: ${candidates.length})`);

            // Determine the base URL based on provider
            let baseUrl = '';
            if (upstream.provider === 'openai') baseUrl = 'https://api.openai.com/v1/chat/completions';
            else if (upstream.provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
            else if (upstream.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
            else if (upstream.provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

            if (!baseUrl) {
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] Unknown provider ${upstream.provider}`);
                continue; // Try next
            }

            // Deep copy the body so provider-specific normalizations don't mutate the original
            // This is crucial for fallback: if Google fails, the next provider needs the original fields.
            const forwardBody = JSON.parse(JSON.stringify(body));

            // Cap max_tokens to prevent provider rejections and credit pre-reservation issues on OpenRouter
            if (forwardBody.max_tokens && forwardBody.max_tokens > 16000) {
                forwardBody.max_tokens = 16000;
            }

            // Google OpenAI-compat normalization for gemini-3+ models:
            if (upstream.provider === 'google') {
                // 1. Map max_completion_tokens → max_tokens (google compat uses max_tokens)
                if (forwardBody.max_completion_tokens && !forwardBody.max_tokens) {
                    forwardBody.max_tokens = forwardBody.max_completion_tokens;
                }
                // 2. Remove fields Google does not support
                delete forwardBody.store;
                delete forwardBody.stream_options;
                delete forwardBody.max_completion_tokens;

                // 3. Normalize messages
                if (Array.isArray(forwardBody.messages)) {
                    forwardBody.messages = forwardBody.messages.map((msg: any) => {
                        // Flatten content arrays (OpenAI content blocks) → plain string
                        let content = msg.content;
                        if (Array.isArray(content)) {
                            content = content
                                .map((block: any) => {
                                    if (typeof block === 'string') return block;
                                    if (block?.type === 'text') return block.text ?? '';
                                    return '';
                                })
                                .join('');
                        }
                        // role:tool → role:user (Google compat rejects tool role)
                        if (msg.role === 'tool') {
                            return { role: 'user', content: content ?? '' };
                        }
                        // assistant: content must not be null
                        if (msg.role === 'assistant' && (content === null || content === undefined)) {
                            content = '';
                        }
                        return { ...msg, content };
                    });
                }
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
                    body: JSON.stringify(forwardBody)
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const isRateLimit = response.status === 429;
                    const errMsg = errData.error?.message || response.statusText;
                    markProviderError(upstream.id, isRateLimit ? 'rate_limited' : 'error', errMsg);

                    finalStatus = response.status;
                    finalErrorMsg = errMsg;
                    finalErrorData = errData;
                    const timestamp = new Date().toISOString();
                    console.error(`[${timestamp}] [Fallback] API request failed with ${response.status}: ${errMsg}`);
                    if (response.status === 400) {
                        // Debug: show what we sent and what Google returned
                        console.error(`[${timestamp}] [Debug400] Body keys sent: ${Object.keys(body).join(', ')}`);
                        console.error(`[${timestamp}] [Debug400] Body model: ${body.model}, stream: ${body.stream}, max_tokens: ${body.max_tokens}, tools count: ${(body.tools || []).length}`);
                        console.error(`[${timestamp}] [Debug400] Google error: ${JSON.stringify(errData).substring(0, 500)}`);
                    }

                    if (isRateLimit || response.status >= 500) {
                        continue; // try next candidate if rate limited or server error
                    } else {
                        // Bad request, no need to fallback, return right away
                        break;
                    }
                }

                // Handle SSE (Server-Sent Events) Streaming
                // If the client requested stream: true, we must stream the upstream response
                // immediately to avoid buffer-induced latency (Time-Between-Tokens delay).
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
                        if (logErr) {
                            const timestamp = new Date().toISOString();
                            console.error(`[${timestamp}] Logging failed:`, logErr);
                        }
                    });

                    c.header('Content-Type', 'text/event-stream');
                    c.header('Cache-Control', 'no-cache');
                    c.header('Connection', 'keep-alive');

                    // stream() uses Hono's streaming wrapper to pipe the fetch ReadableStream
                    // directly to the client socket without buffering the chunks in Node.js.
                    // This creates a perfect real-time typing effect in the OpenClaw terminal.
                    return stream(c, async (s) => {
                        const reader = response.body!.getReader();

                        s.onAbort(() => {
                            const timestamp = new Date().toISOString();
                            console.log(`[${timestamp}] [Stream] Client disconnected from ${usedProvider}, aborting upstream fetch.`);
                            reader.cancel().catch(() => { });
                        });

                        try {
                            const timestamp = new Date().toISOString();
                            console.log(`[${timestamp}] [Stream] Started streaming from ${usedProvider}`);
                            let chunkCount = 0;
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) {
                                    const ts = new Date().toISOString();
                                    console.log(`[${ts}] [Stream] Finished reading from ${usedProvider} after ${chunkCount} chunks. Closing.`);
                                    break;
                                }
                                chunkCount++;
                                await s.write(value); // Flush the chunk instantly to the client
                                // console.log(`[Stream] Wrote chunk ${chunkCount} of length ${value?.length}`);
                            }
                        } catch (err: any) {
                            const timestamp = new Date().toISOString();
                            console.error(`[${timestamp}] [Stream] Error streaming from ${usedProvider}:`, err.message);
                        }
                    });
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
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] [Fallback] Fetch error: ${fetchErr.message}`);
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
            if (logErr) {
                const timestamp = new Date().toISOString();
                console.error(`[${timestamp}] Logging failed:`, logErr);
            }
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
