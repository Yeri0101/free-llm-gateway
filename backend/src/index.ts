import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as dotenv from 'dotenv';
import * as dns from 'node:dns';

// Fix for Node.js fetch() timeout on Windows with Google APIs IPv6 
dns.setDefaultResultOrder('ipv4first');

import { supabase } from './db';

import projectsRoute from './routes/projects';
import upstreamKeysRoute from './routes/upstreamKeys';
import gatewayKeysRoute from './routes/gatewayKeys';
import v1Route from './routes/v1';
import analyticsRoute from './routes/analytics';

dotenv.config();

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/api/projects', projectsRoute);
app.route('/api/providers', upstreamKeysRoute);
app.route('/api/gateway-keys', gatewayKeysRoute);
app.route('/api/analytics', analyticsRoute);
app.route('/v1', v1Route);

app.get('/', (c) => {
    return c.json({ message: 'OpenClaw API Gateway Running' });
});

app.post('/api/auth/login', async (c) => {
    const { username, password } = await c.req.json();

    // Very simplistic auth for the admin panel using our Admins table
    const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !data || data.password_hash !== password) {
        // Note: In production, use bcrypt to compare hashes. 
        // For this prototype we will compare plain text to hash column to keep it simple, 
        // but ideally we should hash it. Let's assume password_hash is plain text for this scaffold unless changed.
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Issue a simple token (mock JWT for now)
    return c.json({ token: 'mock-admin-token-123', user: data.username });
});

app.put('/api/auth/password', async (c) => {
    const { username, currentPassword, newPassword } = await c.req.json();

    const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !data || data.password_hash !== currentPassword) {
        return c.json({ error: 'Invalid current password' }, 401);
    }

    const { error: updateError } = await supabase
        .from('admins')
        .update({ password_hash: newPassword })
        .eq('username', username);

    if (updateError) {
        return c.json({ error: updateError.message }, 500);
    }

    return c.json({ success: true });
});

const port = parseInt(process.env.PORT || '3000');
console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port
});
