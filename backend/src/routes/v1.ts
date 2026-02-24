import { Hono } from 'hono';
import { supabase } from '../db';
import { gatewayAuth } from '../middleware/gatewayAuth';
import { providerStates, updateProviderCalls, markProviderError } from '../utils/limitTracker';

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
        const healthyAllowed = allowed.filter((m: any) => {
            const state = providerStates[m.upstream_key_id];
            if (state && state.status !== 'healthy') {
                return false;
            }
            return true;
        });

        // Fallback to all mapping if everything is rate_limited (at least let them hit the API to see the error)
        const candidates = healthyAllowed.length > 0 ? healthyAllowed : allowed;

        if (candidates.length === 0) {
            return c.json({ error: { message: `Model ${requestedModel} is not available or all keys are exhausted.`, type: "invalid_request_error" } }, 403);
        }

        // Round-robin load balancing logic
        const counterKey = `${gatewayKey.id}:${requestedModel}`;
        if (typeof modelCounters[counterKey] === 'undefined') {
            modelCounters[counterKey] = 0;
        }

        // Select the next upstream key and increment the counter
        const selectedIndex = modelCounters[counterKey] % candidates.length;
        const selectedMapping = candidates[selectedIndex];

        // Update the counter for the next request
        modelCounters[counterKey]++;

        const { data: upstream, error } = await supabase
            .from('upstream_keys')
            .select('*')
            .eq('id', selectedMapping.upstream_key_id)
            .single();

        if (error || !upstream) {
            return c.json({ error: { message: "Upstream provider not found or misconfigured.", type: "api_error" } }, 500);
        }

        console.log(`[Load Balancer] Using upstream key ${upstream.id} for model ${requestedModel} (Index: ${selectedIndex}, Total Options: ${allowed.length})`);

        // Determine the base URL based on provider
        let baseUrl = '';
        if (upstream.provider === 'openai') baseUrl = 'https://api.openai.com/v1/chat/completions';
        else if (upstream.provider === 'groq') baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
        else if (upstream.provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
        else return c.json({ error: { message: `Unknown provider ${upstream.provider}` } }, 500);

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
            return c.json({ error: { message: errMsg, upstream_status: response.status } }, response.status as any);
        }

        // Handle streaming
        if (body.stream && response.body) {
            // Approximation for streaming 
            updateProviderCalls(upstream.id, 500);
            c.header('Content-Type', 'text/event-stream');
            c.header('Cache-Control', 'no-cache');
            c.header('Connection', 'keep-alive');
            return c.body(response.body);
        }

        // Handle non-streaming
        const data = await response.json();

        // Count limits safely
        const tokens = data.usage?.total_tokens || 1000;
        updateProviderCalls(upstream.id, tokens);

        // Inject metadata for debugging and verifying rotation
        data._openclaw_metadata = {
            provider: upstream.provider,
            upstream_key_id: upstream.id
        };

        return c.json(data, response.status as any);

    } catch (err: any) {
        return c.json({ error: { message: err.message, type: "internal_server_error" } }, 500);
    }
});

export default v1;
