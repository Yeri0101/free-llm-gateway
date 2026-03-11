import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../api';
import { FolderOpen, Plus, Trash2, Edit2, X, Settings, LogOut, Zap, Palette } from 'lucide-react';
import { useLanguage } from '../i18n';

type Project = {
    id: string;
    name: string;
    color?: string;
    created_at: string;
};

const PROJECT_COLORS = [
    '#ff6b2b', // orange (default)
    '#ffaa00', // amber
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#ef4444', // red
];

export default function Dashboard() {
    const { t } = useLanguage();
    const [projects, setProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [colorPickerId, setColorPickerId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [credsForm, setCredsForm] = useState({ currentUsername: '', currentPassword: '', newUsername: '', newPassword: '' });
    const navigate = useNavigate();

    const loadProjects = async () => {
        try {
            const data = await fetchApi('/projects');
            setProjects(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProjects(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        try {
            await fetchApi('/projects', {
                method: 'POST',
                body: JSON.stringify({ name: newProjectName }),
            });
            setNewProjectName('');
            loadProjects();
        } catch { alert('Failed to create project'); }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm('Delete this project and all its data?')) return;
        try {
            await fetchApi(`/projects/${id}`, { method: 'DELETE' });
            loadProjects();
        } catch { alert('Failed to delete project'); }
    };

    const handleEditStart = (p: Project, e: React.MouseEvent) => {
        e.preventDefault();
        setEditingId(p.id);
        setEditName(p.name);
        setColorPickerId(null);
    };

    const handleEditSave = async (id: string, e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault();
        if (!editName.trim()) return;
        try {
            await fetchApi(`/projects/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: editName }),
            });
            setEditingId(null);
            loadProjects();
        } catch { alert('Failed to rename project'); }
    };

    const handleColorChange = async (id: string, color: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await fetchApi(`/projects/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ color }),
            });
            setProjects(prev => prev.map(p => p.id === id ? { ...p, color } : p));
            setColorPickerId(null);
        } catch { console.error('Failed to change color'); }
    };

    const handleUpdateCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetchApi('/auth/credentials', {
                method: 'PUT',
                body: JSON.stringify(credsForm),
            });
            alert('Credentials updated. Please log in again.');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err: any) {
            alert(err.message || 'Failed to update credentials.');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                <div className="spinner-ring" style={{ width: 32, height: 32, borderWidth: 3 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading projects…</p>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Page header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '2rem' }}>
                <div>
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.35rem' }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.25)',
                            borderRadius: 'var(--radius-pill)', padding: '0.2rem 0.65rem',
                            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                            color: 'var(--brand-orange)', textTransform: 'uppercase',
                        }}>
                            <Zap size={9} /> SOAT Gateway
                        </span>
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
                        {t('dashboard.title')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>{t('dashboard.subtitle')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button id="dashboard-settings-btn" onClick={() => setShowSettings(true)}
                        className="btn btn-secondary btn-icon" title="Settings">
                        <Settings size={16} />
                    </button>
                    <button id="dashboard-logout-btn"
                        onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
                        className="btn btn-danger btn-icon" title="Logout">
                        <LogOut size={15} />
                    </button>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div onClick={() => setShowSettings(false)} style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
                    animation: 'fadeIn 0.2s ease-out',
                }}>
                    <div onClick={e => e.stopPropagation()} className="glass-panel" style={{
                        width: '100%', maxWidth: 420, padding: '2rem', border: '1px solid var(--border-accent)',
                    }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
                            <div className="flex items-center gap-2">
                                <Settings size={17} style={{ color: 'var(--brand-orange)' }} />
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Update Credentials</h3>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="btn btn-secondary btn-icon"><X size={15} /></button>
                        </div>

                        <form onSubmit={handleUpdateCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Current Username</label>
                                <input type="text" value={credsForm.currentUsername}
                                    onChange={e => setCredsForm({ ...credsForm, currentUsername: e.target.value })} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Current Password</label>
                                <input type="password" value={credsForm.currentPassword}
                                    onChange={e => setCredsForm({ ...credsForm, currentPassword: e.target.value })} required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>New Username <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                <input type="text" value={credsForm.newUsername}
                                    onChange={e => setCredsForm({ ...credsForm, newUsername: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                <label>New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                <input type="password" value={credsForm.newPassword}
                                    onChange={e => setCredsForm({ ...credsForm, newPassword: e.target.value })} />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettings(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update & Relogin</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Project */}
            <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: '0.875rem' }}>
                    <Plus size={16} style={{ color: 'var(--brand-orange)' }} />
                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>{t('dashboard.create_title')}</h3>
                </div>
                <form onSubmit={handleCreate} className="flex gap-3 items-center">
                    <input
                        id="new-project-name"
                        type="text"
                        placeholder={t('dashboard.input_placeholder')}
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        required
                        style={{ flex: 1, marginBottom: 0 }}
                    />
                    <button id="create-project-btn" type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Plus size={15} /> {t('dashboard.btn_create')}
                    </button>
                </form>
            </div>

            {/* Section label */}
            <div className="section-label" style={{ marginBottom: '1rem' }}>
                <FolderOpen size={12} />
                Projects ({projects.length})
            </div>

            {/* Projects Grid */}
            <div className="projects-grid">
                {projects.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div className="empty-state">
                            <div className="empty-state-icon"><FolderOpen size={28} /></div>
                            <h3>{t('dashboard.no_projects')}</h3>
                            <p>{t('dashboard.no_projects_desc')}</p>
                        </div>
                    </div>
                ) : (
                    projects.map(p => {
                        const projColor = p.color || '#ff6b2b';
                        return (
                            <Link
                                to={`/projects/${p.id}`}
                                key={p.id}
                                className="project-card"
                                style={{ '--project-color': projColor } as any}
                                onClick={e => {
                                    // Prevent navigation when interacting with color/edit controls
                                    if ((e.target as HTMLElement).closest('.card-actions')) e.preventDefault();
                                }}
                            >
                                {/* Card header */}
                                <div className="flex items-center gap-2" style={{ marginBottom: '0.75rem' }}>
                                    <div className="project-color-dot" style={{ background: projColor, boxShadow: `0 0 8px ${projColor}60` }} />

                                    {editingId === p.id ? (
                                        <div className="flex items-center gap-2 card-actions" style={{ flex: 1 }}
                                            onClick={e => e.preventDefault()}>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') handleEditSave(p.id, e as any); if (e.key === 'Escape') setEditingId(null); }}
                                                style={{ flex: 1, padding: '0.3rem 0.6rem', fontSize: '0.85rem', marginBottom: 0, borderColor: projColor }}
                                            />
                                            <button onClick={e => handleEditSave(p.id, e)} className="ctx-edit-save" title="Save">✓</button>
                                            <button onClick={e => { e.preventDefault(); setEditingId(null); }} className="ctx-edit-cancel" title="Cancel">✕</button>
                                        </div>
                                    ) : (
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                                            {p.name}
                                        </h3>
                                    )}
                                </div>

                                {/* Color picker */}
                                {colorPickerId === p.id && (
                                    <div className="color-picker-row card-actions" onClick={e => e.preventDefault()} style={{ marginBottom: '0.75rem' }}>
                                        {PROJECT_COLORS.map(c => (
                                            <button
                                                key={c}
                                                className={`color-swatch${projColor === c ? ' active' : ''}`}
                                                style={{ background: c }}
                                                onClick={e => handleColorChange(p.id, c, e)}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between card-actions" style={{ marginTop: '0.75rem' }}>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </p>

                                    <div className="flex gap-1" onClick={e => e.preventDefault()}>
                                        <button
                                            onClick={e => { e.preventDefault(); setColorPickerId(colorPickerId === p.id ? null : p.id); setEditingId(null); }}
                                            title="Change color"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.35rem', borderRadius: '6px', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = projColor; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                        >
                                            <Palette size={14} />
                                        </button>
                                        <button
                                            onClick={e => handleEditStart(p, e)}
                                            title="Rename"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.35rem', borderRadius: '6px', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--brand-amber)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={e => handleDelete(p.id, e)}
                                            title="Delete project"
                                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.35rem', borderRadius: '6px', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    );
}
