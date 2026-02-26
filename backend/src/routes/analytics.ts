import { Hono } from 'hono';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';

const analytics = new Hono();

analytics.use('*', authMiddleware);

analytics.get('/:projectId', async (c) => {
    const { projectId } = c.req.param();

    // Fetch the last 100 logs for the project
    const { data: logs, error: logsError } = await supabase
        .from('request_logs')
        .select(`
            *,
            gateway_keys(key_name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100);

    if (logsError) return c.json({ error: logsError.message }, 500);

    // Aggregate basic stats
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalTokens = 0;
    let totalLatency = 0;

    const providerUsage: Record<string, number> = {};
    const modelUsage: Record<string, number> = {};

    logs.forEach(log => {
        totalRequests++;
        if (log.status_code >= 200 && log.status_code < 300) {
            successfulRequests++;
        }
        totalTokens += log.total_tokens || 0;
        totalLatency += log.latency_ms || 0;

        // Group by provider
        if (log.provider) {
            providerUsage[log.provider] = (providerUsage[log.provider] || 0) + 1;
        }

        // Group by model
        if (log.model) {
            modelUsage[log.model] = (modelUsage[log.model] || 0) + 1;
        }
    });

    const averageLatency = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 0;

    return c.json({
        stats: {
            totalRequests,
            successRate,
            totalTokens,
            averageLatency
        },
        providerUsage,
        modelUsage,
        recentLogs: logs
    });
});

analytics.delete('/:projectId', async (c) => {
    const { projectId } = c.req.param();
    const { error } = await supabase.from('request_logs').delete().eq('project_id', projectId);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true });
});

export default analytics;
