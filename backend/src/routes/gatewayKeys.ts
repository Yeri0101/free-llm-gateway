import { Hono } from 'hono';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';

const gatewayKeys = new Hono();

gatewayKeys.use('*', authMiddleware);

gatewayKeys.get('/', async (c) => {
    const { data, error } = await supabase
        .from('gateway_keys')
        .select(`
      *,
      projects(name),
      gateway_key_models(upstream_key_id, model_name)
    `)
        .order('created_at', { ascending: false });

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
});

gatewayKeys.post('/', async (c) => {
    const { project_id, key_name, custom_key, models } = await c.req.json();
    // Generate a random key if custom key not provided
    const api_key = custom_key || `gk_${crypto.randomBytes(16).toString('hex')}`;

    // Insert Gateway Key
    const { data: keyData, error: keyError } = await supabase
        .from('gateway_keys')
        .insert([{ project_id, key_name, api_key }])
        .select()
        .single();

    if (keyError) return c.json({ error: keyError.message }, 500);

    // Insert Mapping Models
    // models should be an array of objects: { upstream_key_id, model_name }
    if (models && models.length > 0) {
        const inserts = models.map((m: any) => ({
            gateway_key_id: keyData.id,
            upstream_key_id: m.upstream_key_id,
            model_name: m.model_name
        }));

        const { error: modelError } = await supabase.from('gateway_key_models').insert(inserts);
        if (modelError) {
            // Note: In real world, we'd use a transaction or rollback
            console.error("Failed to map models:", modelError);
        }
    }

    return c.json(keyData, 201);
});

gatewayKeys.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const { error } = await supabase.from('gateway_keys').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
});

export default gatewayKeys;
