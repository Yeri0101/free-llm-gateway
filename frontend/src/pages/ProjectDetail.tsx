import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../api';
import {
    KeyRound, Server, ChevronLeft, Trash2, Plus, RefreshCw,
    Activity, Pause, Play, Zap, Shield, Download, AlertTriangle,
    CheckCircle2, XCircle, Clock, Cpu
} from 'lucide-react';
import { useLanguage } from '../i18n';

type UpstreamKey = { id: string; provider: string; created_at: string; key_preview?: string; max_context_tokens?: number | null };
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

/* ─── Provider color / abbrev config ─── */
const PROVIDER_STYLES: Record<string, { cls: string; abbr: string }> = {
    google: { cls: 'provider-google', abbr: 'GG' },
    cerebras: { cls: 'provider-cerebras', abbr: 'CB' },
    kie: { cls: 'provider-kie', abbr: 'KI' },
    openai: { cls: 'provider-openai', abbr: 'OA' },
    groq: { cls: 'provider-groq', abbr: 'GQ' },
    anthropic: { cls: 'provider-anthropic', abbr: 'AN' },
    puter: { cls: 'provider-puter', abbr: 'PT' },
    brave: { cls: 'provider-brave', abbr: 'BV' },
    openrouter: { cls: 'provider-openrouter', abbr: 'OR' },
};

function ProviderChip({ provider }: { provider: string }) {
    const cfg = PROVIDER_STYLES[provider] ?? { cls: 'provider-default', abbr: provider.slice(0, 2).toUpperCase() };
    return (
        <div className="provider-chip">
            <div className={`provider-icon ${cfg.cls}`}>{cfg.abbr}</div>
            <span style={{ textTransform: 'capitalize' }}>{provider}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        healthy: 'badge-healthy',
        error: 'badge-error',
        rate_limited: 'badge-warning',
        paused: 'badge-paused',
        slow: 'badge-slow',
    };
    return (
        <span className={`badge ${map[status] ?? 'badge-paused'}`}>
            <span className="badge-dot" />
            {status}
        </span>
    );
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

    const [newProvider, setNewProvider] = useState({ provider: 'groq', api_key: '' });
    const [newGateway, setNewGateway] = useState({ key_name: '', custom_key: '' });
    const [availableModels, setAvailableModels] = useState<{ upstream_key_id: string, provider: string, models: any[] }[]>([]);
    const [selectedModels, setSelectedModels] = useState<{ upstream_key_id: string, model_name: string }[]>([]);

    const [testPrompts, setTestPrompts] = useState<Record<string, string>>({});
    const [testModels, setTestModels] = useState<Record<string, string>>({});
    const [testResults, setTestResults] = useState<Record<string, any>>({});
    const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});

    const [_totalRequests, setTotalRequests] = useState<number>(0);
    const [_errorRate, setErrorRate] = useState<number>(0);
    const [_totalTokens, setTotalTokens] = useState<number>(0);
    const [recentRequests, setRecentRequests] = useState<RequestLog[]>([]);

    const [gatewayKeyBulkModels, setGatewayKeyBulkModels] = useState<Record<string, string[]>>({});
    const [expandedAddModels, setExpandedAddModels] = useState<Record<string, boolean>>({});
    // context limit inline-edit state: null = not editing, string = value being typed
    const [ctxLimitEdit, setCtxLimitEdit] = useState<Record<string, string | null>>({});

    /* ─── Data loading ─── */
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

            const modelsData = [];
            for (const p of projProv) {
                try {
                    const res = await fetchApi(`/providers/${p.id}/models`);
                    modelsData.push({ upstream_key_id: p.id, provider: p.provider, models: res.models });
                } catch (e) { console.error('Failed fetching models for provider', p.id); }
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
                    if (analyticsRes.recentLogs) setRecentRequests(analyticsRes.recentLogs);
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
                if (analyticsRes.recentLogs) setRecentRequests(analyticsRes.recentLogs);
            }
        } catch (e) { }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(() => { loadRealtimeData(); }, 4000);
        return () => clearInterval(interval);
    }, [id]);

    /* ─── Handlers ─── */
    const handleAddProvider = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProvider.api_key) return;
        try {
            await fetchApi('/providers', { method: 'POST', body: JSON.stringify({ project_id: id, ...newProvider }) });
            setNewProvider({ ...newProvider, api_key: '' });
            loadData();
        } catch (err) { alert('Failed to add provider'); }
    };

    const handleDeleteProvider = async (provId: string) => {
        if (!confirm('Delete provider key?')) return;
        try {
            await fetchApi(`/providers/${provId}`, { method: 'DELETE' });
            loadData();
        } catch (err) { alert('Failed to delete'); }
    };

    const handleSaveContextLimit = async (provId: string) => {
        const raw = ctxLimitEdit[provId];
        const value = raw === '' || raw === null ? null : Number(raw);
        if (value !== null && (isNaN(value) || value < 100)) {
            alert('Enter a number ≥ 100, or leave blank to remove the limit');
            return;
        }
        try {
            await fetchApi(`/providers/${provId}/context-limit`, {
                method: 'PATCH',
                body: JSON.stringify({ max_context_tokens: value }),
            });
            // Update local state immediately — no full reload needed
            setProviders(prev => prev.map(p =>
                p.id === provId ? { ...p, max_context_tokens: value } : p
            ));
            setCtxLimitEdit(prev => ({ ...prev, [provId]: null }));
        } catch (err) { alert('Failed to save context limit'); }
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
                body: JSON.stringify({ project_id: id, ...newGateway, models: selectedModels }),
            });
            setNewGateway({ key_name: '', custom_key: '' });
            setSelectedModels([]);
            loadData();
        } catch (err) { alert('Failed to create gateway key'); }
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
            setGatewayKeyBulkModels(prev => ({ ...prev, [gwId]: [] }));
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
        if (!prompt || !model) { alert('Please enter a prompt and select a model.'); return; }
        setTestLoading(prev => ({ ...prev, [gatewayKey.id]: true }));
        setTestResults(prev => ({ ...prev, [gatewayKey.id]: null }));
        try {
            const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;
            const res = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${gatewayKey.api_key}` },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
            });
            const data = await res.json();
            setTestResults(prev => ({ ...prev, [gatewayKey.id]: { status: res.status, data } }));
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
            Object.entries(analyticsData.providerUsage).forEach(([prov, count]) => { md += `- **${prov}**: ${count} requests\n`; });
        } else { md += `- No provider data available.\n`; }
        md += `\n## Top Models\n`;
        if (analyticsData.modelUsage && Object.keys(analyticsData.modelUsage).length > 0) {
            Object.entries(analyticsData.modelUsage).forEach(([model, count]) => { md += `- **${model}**: ${count} requests\n`; });
        } else { md += `- No model data available.\n`; }
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

    /* ─── Render guards ─── */
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner-ring" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                    loading project...
                </p>
            </div>
        );
    }
    if (!project) return <div className="glass-panel"><p>Project not found</p></div>;

    /* ─── Main render ─── */
    return (
        <div>
            {/* Back link */}
            <Link to="/" className="back-link">
                <ChevronLeft size={16} /> {t('project.back')}
            </Link>

            {/* Project Header */}
            <div className="project-header">
                <div className="project-icon">
                    <Server size={26} style={{ color: 'var(--brand-cyan)' }} />
                </div>
                <div className="project-meta" style={{ flex: 1 }}>
                    <h1 style={{ marginBottom: '0.35rem' }}>{project.name}</h1>
                    <code className="project-id">{project.id}</code>
                </div>
                <div className="soat-pill">
                    <Shield size={10} /> SOAT Active
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    id="tab-providers"
                    className={`tab ${activeTab === 'providers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('providers')}
                >
                    <Server size={14} />
                    {t('project.tab_providers')}
                </button>
                <button
                    id="tab-gateway"
                    className={`tab ${activeTab === 'gateway' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gateway')}
                >
                    <KeyRound size={14} />
                    {t('project.tab_gateway')}
                </button>
                <button
                    id="tab-analytics"
                    className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    <Activity size={14} />
                    {t('project.tab_analytics')}
                </button>
            </div>

            {/* ══════════════════════════════════════════
          TAB: PROVIDERS
      ══════════════════════════════════════════ */}
            {activeTab === 'providers' && (
                <div className="side-panel-layout">
                    {/* Add Provider Form */}
                    <div className="glass-panel">
                        <div className="section-label" style={{ marginBottom: '1.25rem' }}>
                            <Plus size={11} /> {t('project.add_provider')}
                        </div>
                        <form onSubmit={handleAddProvider}>
                            <div className="form-group">
                                <label>{t('project.provider')}</label>
                                <select
                                    value={newProvider.provider}
                                    onChange={e => setNewProvider({ ...newProvider, provider: e.target.value })}
                                >
                                    <option value="groq">Groq</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="google">Google</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="minimax">MiniMax</option>
                                    <option value="kie">Kie (Gemini vía Kie)</option>
                                    <option value="cerebras">Cerebras</option>
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
                            <button type="submit" className="btn btn-primary w-full" style={{ gap: '0.4rem' }}>
                                <Plus size={15} /> {t('project.btn_save_fetch')}
                            </button>
                        </form>
                    </div>

                    {/* Providers List */}
                    <div>
                        <div className="glass-panel">
                            <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
                                <div className="section-label" style={{ marginBottom: 0, flex: 1 }}>
                                    <Server size={11} /> {t('project.configured_providers')} ({providers.length})
                                </div>
                                <div className="flex gap-2" style={{ flexShrink: 0, marginLeft: '1rem' }}>
                                    <button
                                        onClick={handlePauseAllProjectProviders}
                                        className="btn btn-warning"
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                                        title="Pause all project keys"
                                    >
                                        <Pause size={12} /> Pause All
                                    </button>
                                    <button
                                        onClick={handleResetAllProviders}
                                        className="btn btn-success"
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
                                        title="Reset All to Healthy"
                                    >
                                        <RefreshCw size={12} /> Restart All
                                    </button>
                                    <button
                                        onClick={loadData}
                                        className="btn btn-secondary btn-icon"
                                        title="Refresh"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            </div>

                            {providers.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><Server size={24} /></div>
                                    <h3>{t('project.no_providers')}</h3>
                                    <p>Add your first upstream API key using the form on the left.</p>
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('project.provider')} / Key ID</th>
                                            <th>{t('project.status')}</th>
                                            <th>{t('project.usage')}</th>
                                            <th style={{ whiteSpace: 'nowrap' }}>Ctx Limit</th>
                                            <th>{t('project.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providers.map((p, index) => {
                                            const health = providerHealth[p.id] || { status: 'healthy', requestsPerMinute: 0, requestsPerDay: 0, tokensPerMinute: 0, tokensPerDay: 0 };
                                            const status = health.status;
                                            return (
                                                <tr key={p.id}>
                                                    <td>
                                                        <div style={{ marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.35rem', fontFamily: 'var(--font-mono)' }}>#{index + 1}</span>
                                                            <ProviderChip provider={p.provider} />
                                                        </div>
                                                        <div className="provider-id">{p.key_preview || p.id.split('-')[0] + '...'}</div>
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <StatusBadge status={status} />
                                                            {health?.error && (
                                                                <div
                                                                    style={{ fontSize: '0.7rem', color: 'var(--status-error)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.25rem' }}
                                                                    title={health.error}
                                                                >
                                                                    {health.error}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                                                            <div style={{ color: 'var(--text-secondary)' }}>
                                                                <span style={{ color: 'var(--text-muted)' }}>rpm </span>
                                                                {health.requestsPerMinute}
                                                                <span style={{ color: 'var(--border-default)', margin: '0 0.25rem' }}>/</span>
                                                                {health.requestsPerDay}
                                                            </div>
                                                            <div style={{ color: 'var(--text-muted)' }}>
                                                                <span>tok </span>
                                                                {health.tokensPerMinute}
                                                                <span style={{ color: 'var(--border-default)', margin: '0 0.25rem' }}>/</span>
                                                                {health.tokensPerDay}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {/* Ctx Limit inline editor */}
                                                        {ctxLimitEdit[p.id] !== undefined && ctxLimitEdit[p.id] !== null ? (
                                                            <div className="flex items-center gap-1" style={{ minWidth: 130 }}>
                                                                <input
                                                                    type="number"
                                                                    min={100}
                                                                    step={500}
                                                                    autoFocus
                                                                    value={ctxLimitEdit[p.id] ?? ''}
                                                                    onChange={e => setCtxLimitEdit(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveContextLimit(p.id); if (e.key === 'Escape') setCtxLimitEdit(prev => ({ ...prev, [p.id]: null })); }}
                                                                    style={{ width: 80, padding: '0.2rem 0.4rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand-cyan)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
                                                                    placeholder="e.g. 8000"
                                                                />
                                                                <button onClick={() => handleSaveContextLimit(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-healthy)', fontSize: '0.9rem', padding: '0 0.2rem' }} title="Save">✓</button>
                                                                <button onClick={() => setCtxLimitEdit(prev => ({ ...prev, [p.id]: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 0.2rem' }} title="Cancel">✕</button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1" style={{ cursor: 'pointer' }} onClick={() => setCtxLimitEdit(prev => ({ ...prev, [p.id]: p.max_context_tokens != null ? String(p.max_context_tokens) : '' }))} title="Click to set context token limit">
                                                                <code style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: p.max_context_tokens ? 'var(--brand-cyan)' : 'var(--text-muted)', background: p.max_context_tokens ? 'rgba(0,212,255,0.07)' : 'transparent', padding: '0.1rem 0.3rem', borderRadius: 'var(--radius-sm)', border: p.max_context_tokens ? '1px solid rgba(0,212,255,0.2)' : '1px dashed var(--border-subtle)' }}>
                                                                    {p.max_context_tokens ? p.max_context_tokens.toLocaleString() : '∞'}
                                                                </code>
                                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.6 }}>✎</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-2">
                                                            {status === 'paused' ? (
                                                                <button
                                                                    onClick={() => handleResetProvider(p.id)}
                                                                    className="btn btn-success btn-icon"
                                                                    title="Resume"
                                                                >
                                                                    <Play size={14} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handlePauseProvider(p.id)}
                                                                    className="btn btn-secondary btn-icon"
                                                                    title="Pause"
                                                                >
                                                                    <Pause size={14} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleResetProvider(p.id)}
                                                                className="btn btn-secondary btn-icon"
                                                                title="Force Reset"
                                                            >
                                                                <RefreshCw size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteProvider(p.id)}
                                                                className="btn btn-danger btn-icon"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
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

            {/* ══════════════════════════════════════════
          TAB: GATEWAY KEYS
      ══════════════════════════════════════════ */}
            {activeTab === 'gateway' && (
                <div className="side-panel-layout">
                    {/* Create Gateway Form */}
                    <div className="glass-panel">
                        <div className="section-label" style={{ marginBottom: '1.25rem' }}>
                            <KeyRound size={11} /> {t('project.create_gateway')}
                        </div>
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
                            <div className="form-group">
                                <label>{t('project.custom_key')}</label>
                                <input
                                    type="text"
                                    value={newGateway.custom_key}
                                    onChange={e => setNewGateway({ ...newGateway, custom_key: e.target.value })}
                                    placeholder={t('project.custom_key_ph')}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {t('project.select_models')}
                                </label>
                                {availableModels.length > 0 ? (() => {
                                    const allModelIds = Array.from(new Set(availableModels.flatMap(am => am.models.map(m => m.id)))).sort();
                                    const uniqueSelectedModelNames = Array.from(new Set(selectedModels.map(sm => sm.model_name)));
                                    return (
                                        <div>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                Ctrl / Cmd para selección múltiple
                                            </p>
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
                                                style={{ width: '100%', minHeight: '160px', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                                            >
                                                {allModelIds.map(id => (
                                                    <option key={id} value={id}>{id}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })() : (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('project.no_models')}</p>
                                )}
                            </div>

                            <button type="submit" className="btn btn-primary w-full" style={{ gap: '0.4rem' }}>
                                <Plus size={15} /> {t('project.btn_create_key')}
                            </button>
                        </form>
                    </div>

                    {/* Gateway Keys List */}
                    <div>
                        <div className="glass-panel">
                            <div className="section-label" style={{ marginBottom: '1.25rem' }}>
                                <Zap size={11} /> {t('project.active_gateways')} ({gateways.length})
                            </div>

                            {gateways.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><KeyRound size={24} /></div>
                                    <h3>{t('project.no_gateways')}</h3>
                                    <p>Create your first gateway key to start routing requests.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {gateways.map((g, index) => (
                                        <div
                                            key={g.id}
                                            style={{
                                                border: '1px solid var(--border-default)',
                                                borderRadius: 'var(--radius-lg)',
                                                padding: '1.25rem',
                                                background: 'var(--bg-secondary)',
                                                position: 'relative',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {/* top accent line */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'var(--accent-gradient)', opacity: 0.3 }} />

                                            {/* Header */}
                                            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
                                                <div className="flex items-center gap-2">
                                                    <div style={{
                                                        width: 28, height: 28,
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,255,136,0.08))',
                                                        border: '1px solid var(--border-accent)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.65rem', fontWeight: 800, fontFamily: 'var(--font-mono)',
                                                        color: 'var(--brand-cyan)',
                                                    }}>
                                                        {index + 1}
                                                    </div>
                                                    <h4 style={{ margin: 0 }}>{g.key_name}</h4>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteGateway(g.id)}
                                                    className="btn btn-danger btn-icon"
                                                    title="Delete gateway key"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* API Key display */}
                                            <code className="key-display" style={{ marginBottom: '1rem', display: 'block' }}>
                                                {g.api_key}
                                            </code>

                                            {/* Models */}
                                            <div style={{ marginBottom: '1rem' }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                                                    {t('project.allowed_models')} ({Array.from(new Set(g.gateway_key_models?.map(m => m.model_name))).length})
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    {Array.from(new Set(g.gateway_key_models?.map(m => m.model_name))).map((modelName: any, i: number) => (
                                                        <span key={i} className="model-tag">
                                                            {modelName}
                                                            <button
                                                                className="model-tag-remove"
                                                                title="Remove model"
                                                                onClick={() => handleDeleteModelFromGateway(g.id, modelName)}
                                                            >✕</button>
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Add Models expander */}
                                                {availableModels.length > 0 && (
                                                    <div style={{ marginTop: '0.75rem' }}>
                                                        {!expandedAddModels[g.id] ? (
                                                            <button
                                                                onClick={() => setExpandedAddModels(prev => ({ ...prev, [g.id]: true }))}
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.3rem' }}
                                                            >
                                                                <Plus size={12} /> Add Models
                                                            </button>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                                                <select
                                                                    multiple
                                                                    title="Select models to add"
                                                                    value={gatewayKeyBulkModels[g.id] || []}
                                                                    onChange={e => setGatewayKeyBulkModels(prev => ({
                                                                        ...prev,
                                                                        [g.id]: Array.from(e.target.selectedOptions, option => option.value),
                                                                    }))}
                                                                    style={{
                                                                        flex: 1, height: '110px', padding: '0.4rem',
                                                                        borderRadius: 'var(--radius-md)',
                                                                        border: '1px solid var(--brand-cyan)',
                                                                        background: 'var(--bg-tertiary)',
                                                                        color: 'var(--text-primary)',
                                                                        fontSize: '0.8rem',
                                                                        fontFamily: 'var(--font-mono)',
                                                                    }}
                                                                >
                                                                    {Array.from(new Set(availableModels.flatMap(am => am.models.map(m => m.id)))).sort()
                                                                        .filter(id => !g.gateway_key_models?.some(gm => gm.model_name === id))
                                                                        .map(id => (
                                                                            <option key={id} value={id}>{id}</option>
                                                                        ))}
                                                                </select>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            handleAddModelsToGateway(g.id);
                                                                            setExpandedAddModels(prev => ({ ...prev, [g.id]: false }));
                                                                            setGatewayKeyBulkModels(prev => ({ ...prev, [g.id]: [] }));
                                                                        }}
                                                                        className="btn btn-primary"
                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                                    >
                                                                        Add
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedAddModels(prev => ({ ...prev, [g.id]: false }));
                                                                            setGatewayKeyBulkModels(prev => ({ ...prev, [g.id]: [] }));
                                                                        }}
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Test section */}
                                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                                                <div className="section-label" style={{ marginBottom: '0.75rem' }}>
                                                    <Zap size={10} /> {t('project.test_gateway')}
                                                </div>
                                                <div className="flex gap-2" style={{ marginBottom: '0.5rem' }}>
                                                    <select
                                                        value={testModels[g.id] || ''}
                                                        onChange={e => setTestModels(prev => ({ ...prev, [g.id]: e.target.value }))}
                                                        style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', outline: 'none' }}
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
                                                    style={{
                                                        width: '100%', padding: '0.625rem 0.75rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border-default)',
                                                        background: 'var(--bg-primary)',
                                                        color: 'var(--text-primary)',
                                                        minHeight: '64px',
                                                        marginBottom: '0.5rem',
                                                        fontSize: '0.875rem',
                                                        fontFamily: 'var(--font-sans)',
                                                        resize: 'vertical',
                                                        outline: 'none',
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleTestKey(g)}
                                                    className="btn btn-primary w-full"
                                                    disabled={testLoading[g.id]}
                                                    style={{ gap: '0.4rem' }}
                                                >
                                                    {testLoading[g.id] ? (
                                                        <>
                                                            <span className="spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                                            {t('project.btn_testing')}
                                                        </>
                                                    ) : (
                                                        <><Zap size={14} /> {t('project.btn_test')}</>
                                                    )}
                                                </button>

                                                {/* Test result */}
                                                {testResults[g.id] && (
                                                    <div
                                                        className="test-result"
                                                        style={{ borderColor: testResults[g.id].status === 200 ? 'rgba(0,255,136,0.25)' : 'rgba(248,113,113,0.25)' }}
                                                    >
                                                        <div className="test-result-header">
                                                            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                                                                {testResults[g.id].status === 200
                                                                    ? <CheckCircle2 size={14} style={{ color: 'var(--status-healthy)' }} />
                                                                    : <XCircle size={14} style={{ color: 'var(--status-error)' }} />}
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: testResults[g.id].status === 200 ? 'var(--status-healthy)' : 'var(--status-error)' }}>
                                                                    HTTP {testResults[g.id].status}
                                                                </span>
                                                                {testResults[g.id].data?._openclaw_metadata && (() => {
                                                                    const meta = testResults[g.id].data._openclaw_metadata;
                                                                    const cfg = PROVIDER_STYLES[meta.provider] ?? { cls: 'provider-default', abbr: (meta.provider || '??').slice(0, 2).toUpperCase() };
                                                                    return (
                                                                        <>
                                                                            <div className="provider-chip" style={{ fontSize: '0.7rem' }}>
                                                                                <div className={`provider-icon ${cfg.cls}`} style={{ width: 18, height: 18, fontSize: '0.55rem' }}>{cfg.abbr}</div>
                                                                                <span style={{ textTransform: 'capitalize' }}>{meta.provider}</span>
                                                                            </div>
                                                                            {meta.upstream_key_id && (
                                                                                <code style={{
                                                                                    fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                                                                                    color: 'var(--brand-cyan)', background: 'rgba(0,212,255,0.07)',
                                                                                    padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)',
                                                                                    border: '1px solid rgba(0,212,255,0.15)',
                                                                                }}>
                                                                                    {meta.upstream_key_id.split('-')[0]}…
                                                                                </code>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <button
                                                                onClick={() => setTestResults(prev => ({ ...prev, [g.id]: { ...prev[g.id], showRaw: !prev[g.id].showRaw } }))}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline', fontFamily: 'var(--font-mono)', flexShrink: 0 }}
                                                            >
                                                                {testResults[g.id].showRaw ? 'formatted' : 'raw json'}
                                                            </button>
                                                        </div>
                                                        <div className="test-result-body">
                                                            {testResults[g.id].status === 200 && !testResults[g.id].showRaw && testResults[g.id].data?.choices?.[0]?.message?.content
                                                                ? testResults[g.id].data.choices[0].message.content
                                                                : JSON.stringify(testResults[g.id].data || testResults[g.id].error, null, 2)}
                                                        </div>
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

            {/* ══════════════════════════════════════════
          TAB: ANALYTICS
      ══════════════════════════════════════════ */}
            {activeTab === 'analytics' && (
                <div>
                    {/* Actions row */}
                    <div className="flex justify-end gap-2" style={{ marginBottom: '1.5rem' }}>
                        <button onClick={handleExportAnalytics} className="btn btn-secondary" style={{ gap: '0.4rem' }}>
                            <Download size={14} /> {t('project.analytics.export')}
                        </button>
                        <button onClick={handleClearAnalytics} className="btn btn-danger" style={{ gap: '0.4rem' }}>
                            <AlertTriangle size={14} /> {t('project.analytics.clear')}
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-label">
                                <Activity size={10} style={{ display: 'inline', marginRight: 4 }} />
                                {t('project.analytics.total_reqs')}
                            </div>
                            <div className="stat-value white">{analyticsData?.stats?.totalRequests || 0}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">
                                <CheckCircle2 size={10} style={{ display: 'inline', marginRight: 4 }} />
                                {t('project.analytics.success_rate')}
                            </div>
                            <div className="stat-value green">{analyticsData?.stats?.successRate || 0}%</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">
                                <Cpu size={10} style={{ display: 'inline', marginRight: 4 }} />
                                {t('project.analytics.tokens')}
                            </div>
                            <div className="stat-value cyan">{(analyticsData?.stats?.totalTokens || 0).toLocaleString()}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">
                                <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                                {t('project.analytics.latency')}
                            </div>
                            <div className="stat-value amber">{analyticsData?.stats?.averageLatency || 0}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms</span></div>
                        </div>
                    </div>

                    {/* Provider / Model usage */}
                    <div className="flex gap-4" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="glass-panel" style={{ flex: 1 }}>
                            <div className="section-label">
                                <Server size={11} /> {t('project.analytics.top_providers')}
                            </div>
                            {analyticsData?.providerUsage ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {Object.entries(analyticsData.providerUsage).map(([prov, count]: any) => {
                                        const total = Object.values(analyticsData.providerUsage).reduce((a: any, b: any) => a + b, 0) as number;
                                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                        return (
                                            <li key={prov} style={{ marginBottom: '0.875rem' }}>
                                                <div className="flex justify-between items-center" style={{ marginBottom: '0.3rem' }}>
                                                    <ProviderChip provider={prov} />
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--brand-cyan)', fontWeight: 600 }}>
                                                        {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>reqs</span>
                                                    </span>
                                                </div>
                                                <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 2, transition: 'width 0.6s var(--ease-smooth)' }} />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('project.analytics.no_provider_data')}</p>}
                        </div>

                        <div className="glass-panel" style={{ flex: 1 }}>
                            <div className="section-label">
                                <Cpu size={11} /> {t('project.analytics.top_models')}
                            </div>
                            {analyticsData?.modelUsage ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {Object.entries(analyticsData.modelUsage).map(([mod, count]: any) => {
                                        const total = Object.values(analyticsData.modelUsage).reduce((a: any, b: any) => a + b, 0) as number;
                                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                        return (
                                            <li key={mod} style={{ marginBottom: '0.875rem' }}>
                                                <div className="flex justify-between items-center" style={{ marginBottom: '0.3rem' }}>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{mod}</span>
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--brand-cyan)', fontWeight: 600, flexShrink: 0 }}>
                                                        {count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>reqs</span>
                                                    </span>
                                                </div>
                                                <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #00ff88, #00d4ff)', borderRadius: 2, transition: 'width 0.6s var(--ease-smooth)' }} />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('project.analytics.no_model_data')}</p>}
                        </div>
                    </div>

                    {/* Recent requests table */}
                    <div className="glass-panel">
                        <div className="section-label">
                            <Activity size={11} /> {t('project.analytics.recent_requests') || 'Recent Requests'}
                        </div>
                        <div style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Provider</th>
                                        <th>Model</th>
                                        <th>Status</th>
                                        <th>Latency</th>
                                        <th>Tokens</th>
                                        <th>Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                                                No recent requests.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentRequests.map((req: any) => (
                                            <tr key={req.id}>
                                                <td style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                    {new Date(req.created_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    <span style={{ opacity: 0.5 }}>.{new Date(req.created_at).getMilliseconds()}</span>
                                                </td>
                                                <td>
                                                    {req.provider ? <ProviderChip provider={req.provider} /> : '—'}
                                                </td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {req.model}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-pill)',
                                                        fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                                                        background: (req.status_code || 200) < 400 ? 'rgba(0,255,136,0.08)' : 'rgba(248,113,113,0.08)',
                                                        color: (req.status_code || 200) < 400 ? 'var(--status-healthy)' : 'var(--status-error)',
                                                        border: `1px solid ${(req.status_code || 200) < 400 ? 'rgba(0,255,136,0.2)' : 'rgba(248,113,113,0.2)'}`,
                                                    }}>
                                                        {req.status_code || (req.status === 'success' ? 200 : 500)}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: req.latency_ms > 5000 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
                                                    {req.latency_ms}ms
                                                </td>
                                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    {req.total_tokens ? req.total_tokens.toLocaleString() : '—'}
                                                </td>
                                                <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--status-error)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }} title={req.error_message || ''}>
                                                    {req.error_message || '—'}
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
