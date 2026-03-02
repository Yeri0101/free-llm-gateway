import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../api';
import { KeyRound, Server, ChevronLeft, Trash2, Plus, RefreshCw, Activity, Pause, Play } from 'lucide-react';
import { useLanguage } from '../i18n';

type UpstreamKey = { id: string; provider: string; created_at: string; key_preview?: string };
type GatewayKey = { id: string; key_name: string; api_key: string; gateway_key_models: any[] };

interface RequestLog {
    id: string;
    created_at: string;
    provider: string;
    model: string;
    status: 'success' | 'error';
    status_code: number;
    latency_ms: number;
    total_tokens: number;
    error_message?: string;
}

export default function ProjectDetail() {
    const { t } = useLanguage();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState<'providers' | 'gateway' | 'analytics'>('providers');
    const [project, setProject] = useState<any>(null);
    const [providers, setProviders] = useState<UpstreamKey[]>([]);
    const [providerHealth, setProviderHealth] = useState<Record<string, any>>({});
    const [gateways, setGateways] = useState<GatewayKey[]>([]);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Forms limits
    const [newProvider, setNewProvider] = useState({ provider: 'groq', api_key: '' });
    const [newGateway, setNewGateway] = useState({ key_name: '', custom_key: '' });
    const [availableModels, setAvailableModels] = useState<{ upstream_key_id: string, provider: string, models: any[] }[]>([]);
    const [selectedModels, setSelectedModels] = useState<{ upstream_key_id: string, model_name: string }[]>([]);

    const [testPrompts, setTestPrompts] = useState<Record<string, string>>({});
    const [testModels, setTestModels] = useState<Record<string, string>>({});
    const [testResults, setTestResults] = useState<Record<string, any>>({});
    const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});

    // Analytics states
    const [_totalRequests, setTotalRequests] = useState<number>(0);
    const [_errorRate, setErrorRate] = useState<number>(0);
    const [_totalTokens, setTotalTokens] = useState<number>(0);
    const [recentRequests, setRecentRequests] = useState<RequestLog[]>([]);

    const [gatewayKeyBulkModels, setGatewayKeyBulkModels] = useState<Record<string, string[]>>({});
    const [expandedAddModels, setExpandedAddModels] = useState<Record<string, boolean>>({});

    const loadData = async () => {
        try {
            const projData = await fetchApi('/projects');
            const currentProj = projData.find((p: any) => p.id === id);
            setProject(currentProj);

            const provData = await fetchApi('/providers');
            const projProv = provData.filter((p: any) => p.project_id === id);
            setProviders(projProv);

            const gwData = await fetchApi('/gateway-keys');
            setGateways(gwData.filter((g: any) => g.project_id === id));

            try {
                const healthData = await fetchApi('/providers/health');
                setProviderHealth(healthData);
            } catch (e) { console.error('Error fetching health:', e); }

            // Load available models for all providers in this project
            const modelsData = [];
            for (const p of projProv) {
                try {
                    const res = await fetchApi(`/providers/${p.id}/models`);
                    modelsData.push({ upstream_key_id: p.id, provider: p.provider, models: res.models });
                } catch (e) {
                    console.error('Failed fetching models for provider', p.id);
                }
            }

            setAvailableModels(modelsData);

            try {
                const analyticsRes = await fetchApi(`/analytics/${id}`);
                setAnalyticsData(analyticsRes);
                if (analyticsRes) {
                    setTotalRequests(analyticsRes.stats?.totalRequests || 0);
                    const errors = Math.round(analyticsRes.stats.totalRequests * (1 - analyticsRes.stats.successRate / 100));
                    setErrorRate(errors);
                    setTotalTokens(analyticsRes.stats?.totalTokens || 0);

                    if (analyticsRes.recentLogs) {
                        setRecentRequests(analyticsRes.recentLogs);
                    }
                }
            } catch (e) { console.error('Error fetching analytics:', e); }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadRealtimeData = async () => {
        if (!id) return;
        try {
            const healthData = await fetchApi('/providers/health');
            setProviderHealth(healthData);
        } catch (e) { }

        try {
            const analyticsRes = await fetchApi(`/analytics/${id}`);
            setAnalyticsData(analyticsRes);
            if (analyticsRes) {
                setTotalRequests(analyticsRes.stats?.totalRequests || 0);
                const errors = Math.round(analyticsRes.stats.totalRequests * (1 - analyticsRes.stats.successRate / 100));
                setErrorRate(errors);
                setTotalTokens(analyticsRes.stats?.totalTokens || 0);
                if (analyticsRes.recentLogs) {
                    setRecentRequests(analyticsRes.recentLogs);
                }
            }
        } catch (e) { }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(() => {
            loadRealtimeData();
        }, 4000);
        return () => clearInterval(interval);
    }, [id]);

    const handleAddProvider = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProvider.api_key) return;
        try {
            await fetchApi('/providers', {
                method: 'POST',
                body: JSON.stringify({ project_id: id, ...newProvider }),
            });
            setNewProvider({ ...newProvider, api_key: '' });
            loadData();
        } catch (err) {
            alert('Failed to add provider');
        }
    };

    const handleDeleteProvider = async (provId: string) => {
        if (!confirm('Delete provider key?')) return;
        try {
            await fetchApi(`/providers/${provId}`, { method: 'DELETE' });
            loadData();
        } catch (err) { alert('Failed to delete'); }
    };

    const handleResetAllProviders = async () => {
        try {
            await fetchApi(`/providers/reset-all`, { method: 'POST' });
            loadData();
        } catch (err) { alert('Failed to reset all providers'); }
    };

    const handlePauseAllProjectProviders = async () => {
        try {
            await fetchApi(`/projects/${id}/pause-all`, { method: 'POST' });
            loadData();
        } catch (err) { alert('Failed to pause project providers'); }
    };

    const handleResetProvider = async (provId: string) => {
        try {
            await fetchApi(`/providers/${provId}/reset`, { method: 'POST' });
            loadData();
        } catch (err) { alert('Failed to reset provider'); }
    };

    const handlePauseProvider = async (provId: string) => {
        try {
            await fetchApi(`/providers/${provId}/pause`, { method: 'POST' });
            loadData();
        } catch (err) { alert('Failed to pause provider'); }
    };

    const handleCreateGateway = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGateway.key_name) return;
        try {
            await fetchApi('/gateway-keys', {
                method: 'POST',
                body: JSON.stringify({
                    project_id: id,
                    ...newGateway,
                    models: selectedModels
                }),
            });
            setNewGateway({ key_name: '', custom_key: '' });
            setSelectedModels([]);
            loadData();
        } catch (err) {
            alert('Failed to create gateway key');
        }
    };

    const handleDeleteGateway = async (gwId: string) => {
        if (!confirm('Delete gateway key?')) return;
        try {
            await fetchApi(`/gateway-keys/${gwId}`, { method: 'DELETE' });
            loadData();
        } catch (err) { alert('Failed to delete'); }
    };

    const handleAddModelsToGateway = async (gwId: string) => {
        const modelNames = gatewayKeyBulkModels[gwId] || [];
        if (modelNames.length === 0) return;

        let newSelections: { upstream_key_id: string; model_name: string }[] = [];
        modelNames.forEach(model_name => {
            availableModels.forEach(am => {
                if (am.models.some(m => m.id === model_name)) {
                    newSelections.push({ upstream_key_id: am.upstream_key_id, model_name });
                }
            });
        });

        try {
            await fetchApi(`/gateway-keys/${gwId}/models`, {
                method: 'POST',
                body: JSON.stringify({ models: newSelections }),
            });
            setGatewayKeyBulkModels(prev => ({ ...prev, [gwId]: [] })); // reset
            loadData();
        } catch (err) { alert('Failed to add models'); }
    };

    const handleDeleteModelFromGateway = async (gwId: string, modelName: string) => {
        if (!confirm(`Remove ${modelName}?`)) return;
        try {
            await fetchApi(`/gateway-keys/${gwId}/models/${encodeURIComponent(modelName)}`, { method: 'DELETE' });
            loadData();
        } catch (err) { alert('Failed to delete'); }
    };



    const handleTestKey = async (gatewayKey: GatewayKey) => {
        const prompt = testPrompts[gatewayKey.id];
        const model = testModels[gatewayKey.id] || gatewayKey.gateway_key_models?.[0]?.model_name;

        if (!prompt || !model) {
            alert("Please enter a prompt and select a model.");
            return;
        }

        setTestLoading(prev => ({ ...prev, [gatewayKey.id]: true }));
        setTestResults(prev => ({ ...prev, [gatewayKey.id]: null }));

        try {
            // Simulate an external client calling our gateway
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

            const res = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${gatewayKey.api_key}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const data = await res.json();
            setTestResults(prev => ({ ...prev, [gatewayKey.id]: { status: res.status, data } }));

            // Auto reload the limits to show update!
            loadData();
        } catch (err: any) {
            setTestResults(prev => ({ ...prev, [gatewayKey.id]: { status: 500, error: err.message } }));
        } finally {
            setTestLoading(prev => ({ ...prev, [gatewayKey.id]: false }));
        }
    };
    const handleClearAnalytics = async () => {
        if (!confirm(t('project.analytics.clear_confirm'))) return;
        try {
            await fetchApi(`/analytics/${id}`, { method: 'DELETE' });
            loadData();
        } catch (err) { alert('Failed to clear analytics'); }
    };

    const handleExportAnalytics = () => {
        if (!analyticsData) return;

        let md = `# Analytics Report: ${project?.name || 'Project'}\n\n`;
        md += `## Overview\n`;
        md += `- **Total Requests**: ${analyticsData.stats?.totalRequests || 0}\n`;
        md += `- **Success Rate**: ${analyticsData.stats?.successRate || 0}%\n`;
        md += `- **Tokens Processed**: ${(analyticsData.stats?.totalTokens || 0).toLocaleString()}\n`;
        md += `- **Avg Latency**: ${analyticsData.stats?.averageLatency || 0}ms\n\n`;

        md += `## Top Providers\n`;
        if (analyticsData.providerUsage && Object.keys(analyticsData.providerUsage).length > 0) {
            Object.entries(analyticsData.providerUsage).forEach(([prov, count]) => {
                md += `- **${prov}**: ${count} requests\n`;
            });
        } else {
            md += `- No provider data available.\n`;
        }
        md += `\n`;

        md += `## Top Models\n`;
        if (analyticsData.modelUsage && Object.keys(analyticsData.modelUsage).length > 0) {
            Object.entries(analyticsData.modelUsage).forEach(([model, count]) => {
                md += `- **${model}**: ${count} requests\n`;
            });
        } else {
            md += `- No model data available.\n`;
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${project?.name || 'export'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="spinner"></div>;
    if (!project) return <div>Project not found</div>;

    return (
        <div>
            <div className="mb-6">
                <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ChevronLeft size={16} /> {t('project.back')}
                </Link>
            </div>

            <div className="flex items-center gap-4 mb-8">
                <div style={{ width: '48px', height: '48px', background: 'var(--accent-gradient)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Server size={24} color="white" />
                </div>
                <div>
                    <h1 style={{ margin: 0 }}>{project.name}</h1>
                    <p style={{ margin: 0 }}>ID: {project.id}</p>
                </div>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'providers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('providers')}
                >
                    <Server size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    {t('project.tab_providers')}
                </button>
                <button
                    className={`tab ${activeTab === 'gateway' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gateway')}
                >
                    <KeyRound size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    {t('project.tab_gateway')}
                </button>
                <button
                    className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    <Activity size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    {t('project.tab_analytics')}
                </button>
            </div>

            {activeTab === 'providers' && (
                <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
                    <div className="glass-panel" style={{ flex: '1' }}>
                        <h3>{t('project.add_provider')}</h3>
                        <form onSubmit={handleAddProvider}>
                            <div className="form-group">
                                <label>{t('project.provider')}</label>
                                <select value={newProvider.provider} onChange={e => setNewProvider({ ...newProvider, provider: e.target.value })}>
                                    <option value="groq">Groq</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="google">Google</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="minimax">MiniMax</option>
                                    <option value="kie">Kie (Gemini vía Kie)</option>
                                    <option value="brave">Brave Search</option>
                                    <option value="puter">Puter (500+ modelos gratis)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('project.api_key')}</label>
                                <input
                                    type="password"
                                    value={newProvider.api_key}
                                    onChange={e => setNewProvider({ ...newProvider, api_key: e.target.value })}
                                    placeholder="gsk_..."
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full">
                                {t('project.btn_save_fetch')}
                            </button>
                        </form>
                    </div>

                    <div style={{ flex: '2' }}>
                        <div className="glass-panel">
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ margin: 0 }}>{t('project.configured_providers')}</h3>
                                <div className="flex gap-2">
                                    <button onClick={handlePauseAllProjectProviders} className="btn" style={{ padding: '0.4rem 0.75rem', borderRadius: '4px', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }} title="Pause all project keys">
                                        <Pause size={14} /> Pause All
                                    </button>
                                    <button onClick={handleResetAllProviders} className="btn" style={{ padding: '0.4rem 0.75rem', borderRadius: '4px', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }} title="Reset All to Healthy">
                                        <RefreshCw size={14} /> Restart All
                                    </button>
                                    <button onClick={loadData} className="btn" style={{ padding: '0.4rem', borderRadius: '4px', background: 'transparent' }} title="Refresh statuses">
                                        <RefreshCw size={16} />
                                    </button>
                                </div>
                            </div>
                            {providers.length === 0 ? <p>{t('project.no_providers')}</p> : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('project.provider')} / Key ID</th>
                                            <th>{t('project.status')}</th>
                                            <th>{t('project.usage')}</th>
                                            <th>{t('project.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providers.map((p, index) => {
                                            const health = providerHealth[p.id] || { status: 'healthy', requestsPerMinute: 0, requestsPerDay: 0, tokensPerMinute: 0, tokensPerDay: 0 };
                                            const status = health.status;
                                            let statusColor = 'var(--text-muted)';
                                            if (status === 'healthy') statusColor = 'var(--success)';
                                            else if (status === 'rate_limited') statusColor = 'var(--warning)';
                                            else if (status === 'error') statusColor = 'var(--danger)';
                                            else if (status === 'paused') statusColor = 'var(--text-secondary)';

                                            return (
                                                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td>
                                                        <strong style={{ textTransform: 'capitalize' }}>#{index + 1} {p.provider}</strong>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                            {p.key_preview || p.id.split('-')[0] + '...'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}></div>
                                                            {status}
                                                        </span>
                                                        {health?.error && <div style={{ fontSize: '0.7rem', color: 'var(--danger)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={health.error}>{health.error}</div>}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>
                                                        <div>
                                                            <div>Reqs: {health.requestsPerMinute} / {health.requestsPerDay}</div>
                                                            <div style={{ color: 'var(--text-secondary)' }}>Tok: {health.tokensPerMinute} / {health.tokensPerDay}</div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-2">
                                                            {status === 'paused' ? (
                                                                <button onClick={() => handleResetProvider(p.id)} className="btn btn-primary" style={{ padding: '0.4rem', background: 'var(--success)', border: 'none' }} title="Resume">
                                                                    <Play size={16} />
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handlePauseProvider(p.id)} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Pause">
                                                                    <Pause size={16} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleResetProvider(p.id)} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Force Reset">
                                                                <RefreshCw size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteProvider(p.id)} className="btn btn-danger" style={{ padding: '0.4rem' }} title="Delete">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'gateway' && (
                <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
                    <div className="glass-panel" style={{ flex: '1' }}>
                        <h3>{t('project.create_gateway')}</h3>
                        <form onSubmit={handleCreateGateway}>
                            <div className="form-group">
                                <label>{t('project.key_name')}</label>
                                <input
                                    type="text"
                                    value={newGateway.key_name}
                                    onChange={e => setNewGateway({ ...newGateway, key_name: e.target.value })}
                                    placeholder="Agent Rocky"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>{t('project.custom_key')}</label>
                                <input
                                    type="text"
                                    value={newGateway.custom_key}
                                    onChange={e => setNewGateway({ ...newGateway, custom_key: e.target.value })}
                                    placeholder={t('project.custom_key_ph')}
                                />
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('project.select_models')}</label>

                                {availableModels.length > 0 ? (() => {
                                    const allModelIds = Array.from(
                                        new Set(availableModels.flatMap(am => am.models.map(m => m.id)))
                                    ).sort();

                                    const uniqueSelectedModelNames = Array.from(
                                        new Set(selectedModels.map(sm => sm.model_name))
                                    );

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mantén presionado Ctrl (o Cmd) para seleccionar múltiples modelos.</p>
                                            <select
                                                multiple
                                                value={uniqueSelectedModelNames}
                                                onChange={e => {
                                                    const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                                                    const newSelections: { upstream_key_id: string; model_name: string }[] = [];
                                                    selectedValues.forEach(model_name => {
                                                        availableModels.forEach(am => {
                                                            if (am.models.some(m => m.id === model_name)) {
                                                                newSelections.push({ upstream_key_id: am.upstream_key_id, model_name });
                                                            }
                                                        });
                                                    });
                                                    setSelectedModels(newSelections);
                                                }}
                                                style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', minHeight: '180px' }}
                                            >
                                                {allModelIds.map(id => (
                                                    <option key={id} value={id}>{id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })() : (
                                    <p className="text-secondary" style={{ fontSize: '0.9rem' }}>{t('project.no_models')}</p>
                                )}
                            </div>

                            <button type="submit" className="btn btn-primary w-full">
                                <Plus size={18} /> {t('project.btn_create_key')}
                            </button>
                        </form>
                    </div>

                    <div style={{ flex: '2' }}>
                        <div className="glass-panel">
                            <h3>{t('project.active_gateways')}</h3>
                            {gateways.length === 0 ? <p>{t('project.no_gateways')}</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {gateways.map((g, index) => (
                                        <div key={g.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>#{index + 1} {g.key_name}</h4>
                                                <button onClick={() => handleDeleteGateway(g.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <code style={{ display: 'block', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', color: 'var(--accent-primary)', wordBreak: 'break-all', marginBottom: '1rem' }}>
                                                {g.api_key}
                                            </code>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <strong>{t('project.allowed_models')} ({g.gateway_key_models?.length}):</strong>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                                    {Array.from(new Set(g.gateway_key_models?.map(m => m.model_name))).map((modelName: any, i: number) => (
                                                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                            {modelName}
                                                            <button title="Remove model" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }} onClick={() => handleDeleteModelFromGateway(g.id, modelName)}>x</button>
                                                        </span>
                                                    ))}
                                                </div>

                                                {availableModels.length > 0 && (
                                                    <div style={{ marginTop: '1rem' }}>
                                                        {!expandedAddModels[g.id] ? (
                                                            <button
                                                                onClick={() => setExpandedAddModels(prev => ({ ...prev, [g.id]: true }))}
                                                                className="btn btn-secondary btn-sm"
                                                                style={{ fontSize: '0.85rem' }}
                                                            >
                                                                Agregar +
                                                            </button>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                <select
                                                                    multiple
                                                                    title="Multiselect options"
                                                                    value={gatewayKeyBulkModels[g.id] || []}
                                                                    onChange={e => setGatewayKeyBulkModels(prev => ({ ...prev, [g.id]: Array.from(e.target.selectedOptions, option => option.value) }))}
                                                                    style={{ flex: 1, padding: '0.45rem', borderRadius: '6px', border: '1px solid var(--accent-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', height: '120px' }}
                                                                >
                                                                    {Array.from(new Set(availableModels.flatMap(am => am.models.map(m => m.id)))).sort().filter(id => !g.gateway_key_models?.some(gm => gm.model_name === id)).map(id => (
                                                                        <option key={id} value={id} style={{ padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-color)', margin: '0.1rem 0' }}>{id}</option>
                                                                    ))}
                                                                </select>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleAddModelsToGateway(g.id);
                                                                            setExpandedAddModels(prev => ({ ...prev, [g.id]: false }));
                                                                            setGatewayKeyBulkModels(prev => ({ ...prev, [g.id]: [] })); // Clear selection visually too
                                                                        }}
                                                                        className="btn btn-primary"
                                                                    >
                                                                        Aceptar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedAddModels(prev => ({ ...prev, [g.id]: false }));
                                                                            setGatewayKeyBulkModels(prev => ({ ...prev, [g.id]: [] }));
                                                                        }}
                                                                        className="btn btn-secondary"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{t('project.test_gateway')}</h5>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <select
                                                        value={testModels[g.id] || ''}
                                                        onChange={e => setTestModels(prev => ({ ...prev, [g.id]: e.target.value }))}
                                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', flex: 1 }}
                                                    >
                                                        <option value="">{t('project.select_model_ph')}</option>
                                                        {Array.from(new Set(g.gateway_key_models?.map(m => m.model_name))).map((modelName: any, i: number) => (
                                                            <option key={i} value={modelName}>{modelName}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <textarea
                                                    placeholder={t('project.test_prompt_ph')}
                                                    value={testPrompts[g.id] || ''}
                                                    onChange={e => setTestPrompts(prev => ({ ...prev, [g.id]: e.target.value }))}
                                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '60px', marginBottom: '0.5rem' }}
                                                />
                                                <button
                                                    onClick={() => handleTestKey(g)}
                                                    className="btn btn-primary"
                                                    disabled={testLoading[g.id]}
                                                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    {testLoading[g.id] ? <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} /> : null}
                                                    {testLoading[g.id] ? t('project.btn_testing') : t('project.btn_test')}
                                                </button>

                                                {testResults[g.id] && (
                                                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '6px', background: 'var(--bg-primary)', border: `1px solid ${testResults[g.id].status === 200 ? 'var(--success)' : 'var(--danger)'}` }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                <strong style={{ fontSize: '0.85rem', color: testResults[g.id].status === 200 ? 'var(--success)' : 'var(--danger)' }}>
                                                                    Status: {testResults[g.id].status}
                                                                </strong>
                                                                {testResults[g.id].data?._openclaw_metadata && (
                                                                    <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                                                        Respondió: <span style={{ textTransform: 'capitalize', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{testResults[g.id].data._openclaw_metadata.provider}</span> (Key #{providers.findIndex(p => p.id === testResults[g.id].data._openclaw_metadata.upstream_key_id) + 1}: {testResults[g.id].data._openclaw_metadata.upstream_key_id.split('-')[0]}...)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => setTestResults(prev => ({ ...prev, [g.id]: { ...prev[g.id], showRaw: !prev[g.id].showRaw } }))}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                                                            >
                                                                {testResults[g.id].showRaw ? 'Show Formatted' : 'Show Raw JSON'}
                                                            </button>
                                                        </div>

                                                        {testResults[g.id].status === 200 && !testResults[g.id].showRaw && testResults[g.id].data?.choices?.[0]?.message?.content ? (
                                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                                                {testResults[g.id].data.choices[0].message.content}
                                                            </div>
                                                        ) : (
                                                            <pre style={{ fontSize: '0.75rem', overflowX: 'auto', margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                {JSON.stringify(testResults[g.id].data || testResults[g.id].error, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="flex flex-col gap-6">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button onClick={handleExportAnalytics} className="btn btn-secondary">
                            {t('project.analytics.export')}
                        </button>
                        <button onClick={handleClearAnalytics} className="btn btn-danger">
                            {t('project.analytics.clear')}
                        </button>
                    </div>
                    <div className="glass-panel text-center flex justify-between items-center pb-0" style={{ padding: '1.5rem 2rem' }}>
                        <div>
                            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('project.analytics.total_reqs')}</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{analyticsData?.stats?.totalRequests || 0}</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)', height: '60px' }}></div>
                        <div>
                            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('project.analytics.success_rate')}</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)' }}>{analyticsData?.stats?.successRate || 0}%</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)', height: '60px' }}></div>
                        <div>
                            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('project.analytics.tokens')}</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{(analyticsData?.stats?.totalTokens || 0).toLocaleString()}</div>
                        </div>
                        <div style={{ width: '1px', background: 'var(--border-color)', height: '60px' }}></div>
                        <div>
                            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('project.analytics.latency')}</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{analyticsData?.stats?.averageLatency || 0}ms</div>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        <div className="glass-panel" style={{ flex: '1' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>{t('project.analytics.top_providers')}</h3>
                            {analyticsData?.providerUsage ? (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {Object.entries(analyticsData.providerUsage).map(([prov, count]: any) => (
                                        <li key={prov} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{prov}</span>
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{count} reqs</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p>{t('project.analytics.no_provider_data')}</p>}
                        </div>

                        <div className="glass-panel" style={{ flex: '1' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>{t('project.analytics.top_models')}</h3>
                            {analyticsData?.modelUsage ? (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {Object.entries(analyticsData.modelUsage).map(([mod, count]: any) => (
                                        <li key={mod} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                            <span style={{ fontWeight: 500 }}>{mod}</span>
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{count} reqs</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p>{t('project.analytics.no_model_data')}</p>}
                        </div>
                    </div>

                    <div className="glass-panel" style={{ marginTop: '0.5rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={18} className="text-accent-primary" />
                            {t('project.analytics.recent_requests') || 'Tabla de Peticiones y Timestamps'}
                        </h3>
                        <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Timestamp</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Model</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Latency</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Tokens</th>
                                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                Sin peticiones recientes.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentRequests.map((req: any) => (
                                            <tr key={req.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    {new Date(req.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '2px' }}>.{new Date(req.created_at).getMilliseconds()}</span>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{req.model}</td>
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        background: req.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                        color: req.status === 'success' ? 'var(--success)' : 'var(--danger)'
                                                    }}>
                                                        {req.status_code || (req.status === 'success' ? 200 : 500)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{req.latency_ms}ms</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{req.total_tokens || '-'}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--danger)', fontSize: '0.75rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={req.error_message || ''}>
                                                    {req.error_message || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
