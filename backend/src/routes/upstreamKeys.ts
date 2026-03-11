import { Hono } from 'hono';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';
import { PUTER_MODELS } from '../utils/puterClient';

const upstreamKeys = new Hono();

upstreamKeys.use('*', authMiddleware);

import { providerStates, resetAllProvidersStatus, resetProviderStatus, pauseProvider } from '../utils/limitTracker';

upstreamKeys.get('/health', async (c) => {
    return c.json(providerStates);
});

// List upstream keys — includes a masked key_preview (first 4 + last 4 chars) for identification without exposing the full key
upstreamKeys.get('/', async (c) => {
    const { data, error } = await supabase
        .from('upstream_keys')
        .select('id, project_id, provider, created_at, api_key, max_context_tokens, projects(name)')
        .order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);

    const sanitized = (data || []).map((row: any) => {
        const key: string = row.api_key || '';
        const key_preview = key.length > 8
            ? `${key.slice(0, 4)}...${key.slice(-4)}`
            : `${key.slice(0, 2)}...`;
        const { api_key: _removed, ...rest } = row;
        return { ...rest, key_preview };
    });

    return c.json(sanitized);
});

upstreamKeys.post('/', async (c) => {
    const { project_id, provider, api_key } = await c.req.json();
    const { data, error } = await supabase
        .from('upstream_keys')
        .insert([{ project_id, provider, api_key }])
        .select('id, project_id, provider, created_at')
        .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});

upstreamKeys.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const { error } = await supabase.from('upstream_keys').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
});

// PATCH /:id/context-limit — set or clear max_context_tokens for this upstream key
upstreamKeys.patch('/:id/context-limit', async (c) => {
    const { id } = c.req.param();
    const body = await c.req.json();
    // Send null to remove the limit entirely
    const max_context_tokens = body.max_context_tokens === null
        ? null
        : (Number(body.max_context_tokens) || null);
    const { data, error } = await supabase
        .from('upstream_keys')
        .update({ max_context_tokens })
        .eq('id', id)
        .select('id, provider, max_context_tokens')
        .single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
});

upstreamKeys.post('/reset-all', async (c) => {
    resetAllProvidersStatus();
    return c.json({ success: true });
});

upstreamKeys.post('/:id/reset', async (c) => {
    const { id } = c.req.param();
    resetProviderStatus(id);
    return c.json({ success: true });
});

upstreamKeys.post('/:id/pause', async (c) => {
    const { id } = c.req.param();
    pauseProvider(id);
    return c.json({ success: true });
});

// A route to fetch available models for a given Upstream Key
upstreamKeys.get('/:id/models', async (c) => {
    const { id } = c.req.param();

    // 1. Fetch the key from db
    const { data: keyData, error } = await supabase
        .from('upstream_keys')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !keyData) return c.json({ error: 'Key not found' }, 404);

    try {
        // 2. Query provider API for models
        let url = '';
        if (keyData.provider === 'openai') url = 'https://api.openai.com/v1/models';
        else if (keyData.provider === 'groq') url = 'https://api.groq.com/openai/v1/models';
        else if (keyData.provider === 'openrouter') url = 'https://openrouter.ai/api/v1/models';
        else if (keyData.provider === 'cerebras') url = 'https://api.cerebras.ai/v1/models';
        else if (keyData.provider === 'mistral') {
            // Try Mistral API first; fall back to curated list if the key is invalid or rate-limited
            try {
                const mistralRes = await fetch('https://api.mistral.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${keyData.api_key}` }
                });
                if (mistralRes.ok) {
                    const mistralData = await mistralRes.json();
                    const models = mistralData.data || [];
                    if (models.length > 0) {
                        return c.json({ models });
                    }
                }
                console.warn(`[Models] Mistral API returned ${mistralRes.status} — using curated fallback list`);
            } catch (fetchErr: any) {
                console.warn(`[Models] Mistral API fetch failed (${fetchErr.message}) — using curated fallback list`);
            }
            // Fallback: curated list of popular Mistral models
            return c.json({
                models: [
                    // Premier models
                    { id: 'mistral-large-latest' },
                    { id: 'mistral-large-2411' },
                    // Medium / general purpose
                    { id: 'mistral-medium-latest' },
                    { id: 'mistral-small-latest' },
                    { id: 'mistral-small-2503' },
                    // Specialized models
                    { id: 'codestral-latest' },
                    { id: 'codestral-2501' },
                    { id: 'mistral-embed' },
                    // Open-weight models
                    { id: 'open-mistral-nemo' },
                    { id: 'open-mistral-7b' },
                    { id: 'open-mixtral-8x7b' },
                    { id: 'open-mixtral-8x22b' },
                    // Pixtral (multimodal)
                    { id: 'pixtral-large-latest' },
                    { id: 'pixtral-12b-2409' },
                    // Moderation
                    { id: 'mistral-moderation-latest' },
                ]
            });
        }
        else if (keyData.provider === 'google') {
            const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyData.api_key}`);
            if (!googleRes.ok) {
                const err = await googleRes.json().catch(() => ({}));
                throw new Error(`Google API returned ${googleRes.status}: ${err.error?.message || 'Unknown error'}`);
            }
            const googleData = await googleRes.json();
            console.log("GOOGLE RESPONSE DATA:", JSON.stringify(googleData, null, 2).substring(0, 300));
            const mappedModels = (googleData.models || [])
                .map((m: any) => ({
                    id: m.name.replace('models/', '')
                }));
            return c.json({ models: mappedModels });
        }
        else if (keyData.provider === 'puter') {
            // Puter doesn't have a /models endpoint — return our curated list
            return c.json({ models: PUTER_MODELS });
        }
        else if (keyData.provider === 'kie') {
            // Kie doesn't expose a /models endpoint — return a curated list of supported models
            return c.json({
                models: [
                    // Kie specific tags
                    { id: 'gpt-5-2' }, // New model per user doc: gpt-5-2
                    { id: 'gpt-5-2-pro' },
                    { id: 'gpt-5-2-chat-latest' },
                    { id: 'gemini-3-flash' },
                    { id: 'gemini-2.5-flash' },
                    { id: 'gemini-2.5-pro' },
                    { id: 'gemini-2.0-flash' },
                    { id: 'gemini-2.0-pro-exp' },
                    { id: 'gemini-1.5-pro' },
                    { id: 'gemini-1.5-flash' },

                    // GPT / Open AI
                    { id: 'gpt-4o' },
                    { id: 'gpt-4o-mini' },
                    { id: 'o1' },
                    { id: 'o3-mini' },

                    // Anthropic Claude
                    { id: 'claude-3-7-sonnet-20250219' },
                    { id: 'claude-3-5-sonnet-20241022' },
                    { id: 'claude-3-5-haiku-20241022' },

                    // Open Source / Others
                    { id: 'deepseek-chat' }, // v3
                    { id: 'deepseek-reasoner' }, // r1
                    { id: 'llama-3.3-70b-versatile' },
                    { id: 'llama-3.1-8b-instant' }
                ]
            });
        }
        else return c.json({ models: [] }); // default fallback

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${keyData.api_key}`
            }
        });

        if (!response.ok) {
            throw new Error(`Provider returned ${response.status}`);
        }

        const result = await response.json();
        return c.json({ models: result.data || [] });
    } catch (err: any) {
        console.error('Error fetching models for key', id, 'Provider:', keyData.provider, err);
        return c.json({ error: err.message }, 500);
    }
});

export default upstreamKeys;
