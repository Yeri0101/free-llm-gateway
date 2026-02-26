import { Hono } from 'hono';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const upstreamKeys = new Hono();

upstreamKeys.use('*', authMiddleware);

import { providerStates, resetAllProvidersStatus, resetProviderStatus, pauseProvider } from '../utils/limitTracker';

upstreamKeys.get('/health', async (c) => {
    return c.json(providerStates);
});

// List upstream keys (without exposing the actual API key string for security)
upstreamKeys.get('/', async (c) => {
    const { data, error } = await supabase
        .from('upstream_keys')
        .select('id, project_id, provider, created_at, projects(name)')
        .order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
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
