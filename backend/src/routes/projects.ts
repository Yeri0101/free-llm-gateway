import { Hono } from 'hono';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const projects = new Hono();

// Apply auth middleware to all project routes
projects.use('*', authMiddleware);

projects.get('/', async (c) => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
});

projects.post('/', async (c) => {
    const { name } = await c.req.json();
    const { data, error } = await supabase.from('projects').insert([{ name }]).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});

projects.delete('/:id', async (c) => {
    const { id } = c.req.param();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
});

projects.patch('/:id', async (c) => {
    const { id } = c.req.param();
    const { name } = await c.req.json();
    const { data, error } = await supabase.from('projects').update({ name }).eq('id', id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
});

export default projects;
