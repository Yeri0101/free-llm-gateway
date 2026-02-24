import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../api';
import { KeyRound, Server, ChevronLeft, Trash2, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';

type UpstreamKey = { id: string; provider: string; created_at: string };
type GatewayKey = { id: string; key_name: string; api_key: string; gateway_key_models: any[] };

export default function ProjectDetail() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState<'providers' | 'gateway'>('providers');
    const [project, setProject] = useState<any>(null);
    const [providers, setProviders] = useState<UpstreamKey[]>([]);
    const [providerHealth, setProviderHealth] = useState<Record<string, any>>({});
    const [gateways, setGateways] = useState<GatewayKey[]>([]);
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

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
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

    const toggleModelSelection = (upstream_key_id: string, model_name: string) => {
        setSelectedModels(prev => {
            const exists = prev.find(m => m.upstream_key_id === upstream_key_id && m.model_name === model_name);
            if (exists) {
                return prev.filter(m => !(m.upstream_key_id === upstream_key_id && m.model_name === model_name));
            }
            return [...prev, { upstream_key_id, model_name }];
        });
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

    if (loading) return <div className="spinner"></div>;
    if (!project) return <div>Project not found</div>;

    return (
        <div>
            <div className="mb-6">
                <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ChevronLeft size={16} /> Back to Projects
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
                    Upstream Providers
                </button>
                <button
                    className={`tab ${activeTab === 'gateway' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gateway')}
                >
                    <KeyRound size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Gateway Keys
                </button>
            </div>

            {activeTab === 'providers' && (
                <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
                    <div className="glass-panel" style={{ flex: '1' }}>
                        <h3>Add Provider Key</h3>
                        <form onSubmit={handleAddProvider}>
                            <div className="form-group">
                                <label>Provider</label>
                                <select value={newProvider.provider} onChange={e => setNewProvider({ ...newProvider, provider: e.target.value })}>
                                    <option value="groq">Groq</option>
                                    <option value="openrouter">OpenRouter</option>
                                    <option value="openai">OpenAI</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>API Key</label>
                                <input
                                    type="password"
                                    value={newProvider.api_key}
                                    onChange={e => setNewProvider({ ...newProvider, api_key: e.target.value })}
                                    placeholder="gsk_..."
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full">
                                Save & Fetch Models
                            </button>
                        </form>
                    </div>

                    <div style={{ flex: '2' }}>
                        <div className="glass-panel">
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ margin: 0 }}>Configured Providers</h3>
                                <button onClick={loadData} className="btn" style={{ padding: '0.4rem', borderRadius: '4px', background: 'transparent' }} title="Refresh statuses">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            {providers.length === 0 ? <p>No providers configured for this project.</p> : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Provider / Key ID</th>
                                            <th>Status</th>
                                            <th>Usage (Min / Day)</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providers.map(p => {
                                            const health = providerHealth[p.id];
                                            const status = health ? health.status : 'unknown';
                                            const statusColor = status === 'healthy' ? 'var(--success)' : status === 'rate_limited' ? 'var(--warning)' : status === 'error' ? 'var(--danger)' : 'var(--text-muted)';

                                            return (
                                                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td>
                                                        <strong style={{ textTransform: 'capitalize' }}>{p.provider}</strong>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.id.split('-')[0]}...</div>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: statusColor, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}></div>
                                                            {status}
                                                        </span>
                                                        {health?.lastError && <div style={{ fontSize: '0.7rem', color: 'var(--danger)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={health.lastError}>{health.lastError}</div>}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>
                                                        {health ? (
                                                            <div>
                                                                <div>Reqs: {health.requestsPerMinute} / {health.requestsPerDay}</div>
                                                                <div style={{ color: 'var(--text-secondary)' }}>Tok: {health.tokensPerMinute} / {health.tokensPerDay}</div>
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    <td>
                                                        <button onClick={() => handleDeleteProvider(p.id)} className="btn btn-danger" style={{ padding: '0.4rem' }}>
                                                            <Trash2 size={16} />
                                                        </button>
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
                        <h3>Create Gateway Key</h3>
                        <form onSubmit={handleCreateGateway}>
                            <div className="form-group">
                                <label>Key Name (e.g. Agent Rocky)</label>
                                <input
                                    type="text"
                                    value={newGateway.key_name}
                                    onChange={e => setNewGateway({ ...newGateway, key_name: e.target.value })}
                                    placeholder="Agent Rocky"
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Custom Key (Optional)</label>
                                <input
                                    type="text"
                                    value={newGateway.custom_key}
                                    onChange={e => setNewGateway({ ...newGateway, custom_key: e.target.value })}
                                    placeholder="Leave blank for auto-generation"
                                />
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Allowed Models</label>
                                <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                                    {availableModels.length === 0 && <p className="text-secondary" style={{ fontSize: '0.9rem' }}>No models found. Add a provider first.</p>}
                                    {availableModels.map(am => (
                                        <div key={am.upstream_key_id} style={{ marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{am.provider}</h4>
                                            {am.models.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Failed mapping or no models</p>}
                                            {am.models.map(m => {
                                                const isSelected = selectedModels.some(sel => sel.upstream_key_id === am.upstream_key_id && sel.model_name === m.id);
                                                return (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => toggleModelSelection(am.upstream_key_id, m.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                            padding: '0.5rem', borderRadius: '4px', cursor: 'pointer',
                                                            background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                            border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'transparent'}`,
                                                            marginBottom: '0.25rem'
                                                        }}
                                                    >
                                                        {isSelected ? <CheckCircle2 size={16} color="var(--accent-primary)" /> : <div style={{ width: 16, height: 16, border: '1px solid var(--border-color)', borderRadius: '50%' }}></div>}
                                                        <span style={{ fontSize: '0.85rem' }}>{m.id}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary w-full">
                                <Plus size={18} /> Create API Key
                            </button>
                        </form>
                    </div>

                    <div style={{ flex: '2' }}>
                        <div className="glass-panel">
                            <h3>Active Gateway Keys</h3>
                            {gateways.length === 0 ? <p>No gateway keys issued yet.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {gateways.map(g => (
                                        <div key={g.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{g.key_name}</h4>
                                                <button onClick={() => handleDeleteGateway(g.id)} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <code style={{ display: 'block', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', color: 'var(--accent-primary)', wordBreak: 'break-all', marginBottom: '1rem' }}>
                                                {g.api_key}
                                            </code>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                <strong>Allowed Models ({g.gateway_key_models?.length}):</strong>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                                    {g.gateway_key_models?.map((gm: any, i: number) => (
                                                        <span key={i} style={{ background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                            {gm.model_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Test Gateway Key</h5>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <select
                                                        value={testModels[g.id] || ''}
                                                        onChange={e => setTestModels(prev => ({ ...prev, [g.id]: e.target.value }))}
                                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', flex: 1 }}
                                                    >
                                                        <option value="">Select a model...</option>
                                                        {g.gateway_key_models?.map((gm: any, i: number) => (
                                                            <option key={i} value={gm.model_name}>{gm.model_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <textarea
                                                    placeholder="Enter test prompt... e.g. Hello, what can you do?"
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
                                                    {testLoading[g.id] ? 'Testing...' : 'Send Test Request'}
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
                                                                        Respondió: <span style={{ textTransform: 'capitalize', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{testResults[g.id].data._openclaw_metadata.provider}</span> (Key: {testResults[g.id].data._openclaw_metadata.upstream_key_id.split('-')[0]}...)
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
        </div>
    );
}
