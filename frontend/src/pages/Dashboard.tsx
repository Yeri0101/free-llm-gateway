import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../api';
import { FolderGit2, Plus, Trash2, Edit2, Check, X, Settings, LogOut, Layers, Zap } from 'lucide-react';
import { useLanguage } from '../i18n';

type Project = {
    id: string;
    name: string;
    created_at: string;
};

export default function Dashboard() {
    const { t } = useLanguage();
    const [projects, setProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
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
        if (!newProjectName) return;
        try {
            await fetchApi('/projects', {
                method: 'POST',
                body: JSON.stringify({ name: newProjectName }),
            });
            setNewProjectName('');
            loadProjects();
        } catch (err) {
            alert('Failed to create project');
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!confirm(t('dashboard.delete_confirm'))) return;
        try {
            await fetchApi(`/projects/${id}`, { method: 'DELETE' });
            loadProjects();
        } catch (err) {
            alert('Failed to delete project');
        }
    };

    const handleEditStart = (p: Project, e: React.MouseEvent) => {
        e.preventDefault();
        setEditingId(p.id);
        setEditName(p.name);
    };

    const handleEditCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        setEditingId(null);
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
        } catch (err) {
            alert('Failed to rename project');
        }
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
            <div className="loading-screen">
                <div className="spinner-ring" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
                    loading projects...
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="page-header" style={{ marginBottom: 0 }}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="soat-pill">
                            <Zap size={10} /> SOAT Gateway
                        </div>
                    </div>
                    <h1>{t('dashboard.title')}</h1>
                    <p style={{ marginBottom: 0 }}>{t('dashboard.subtitle')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        id="dashboard-settings-btn"
                        onClick={() => setShowSettings(true)}
                        className="btn btn-secondary btn-icon"
                        title="Settings"
                    >
                        <Settings size={16} />
                    </button>
                    <button
                        id="dashboard-logout-btn"
                        onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}
                        className="btn btn-secondary btn-icon"
                        title="Logout"
                        style={{ color: 'var(--status-error)', borderColor: 'rgba(248,113,113,0.2)' }}
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
                    <div className="modal-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="flex items-center gap-2">
                                <Settings size={18} style={{ color: 'var(--brand-cyan)' }} />
                                <h3 style={{ margin: 0 }}>Update Credentials</h3>
                            </div>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="btn btn-secondary btn-icon"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateCredentials} className="flex-col gap-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>New Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                <input type="password" value={credsForm.newPassword}
                                    onChange={e => setCredsForm({ ...credsForm, newPassword: e.target.value })} />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettings(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    Update &amp; Relogin
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Project Panel */}
            <div className="glass-panel mb-8" style={{ marginBottom: '2rem' }}>
                <div className="flex items-center gap-2 mb-4" style={{ marginBottom: '1rem' }}>
                    <Layers size={16} style={{ color: 'var(--brand-cyan)' }} />
                    <h3 style={{ margin: 0 }}>{t('dashboard.create_title')}</h3>
                </div>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>{t('dashboard.create_desc')}</p>
                <form onSubmit={handleCreate} className="flex gap-3 items-center" style={{ gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                        <input
                            id="new-project-name"
                            type="text"
                            placeholder={t('dashboard.input_placeholder')}
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            required
                            style={{ marginBottom: 0 }}
                        />
                    </div>
                    <button id="create-project-btn" type="submit" className="btn btn-primary" style={{ gap: '0.4rem', whiteSpace: 'nowrap' }}>
                        <Plus size={16} />
                        {t('dashboard.btn_create')}
                    </button>
                </form>
            </div>

            {/* Projects section label */}
            <div className="section-label">
                <FolderGit2 size={12} />
                Projects ({projects.length})
            </div>

            {/* Projects Grid */}
            <div className="card-grid">
                {projects.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div className="glass-panel">
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <FolderGit2 size={28} />
                                </div>
                                <h3>{t('dashboard.no_projects')}</h3>
                                <p>{t('dashboard.no_projects_desc')}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    projects.map(p => (
                        <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ height: '100%', minHeight: '140px' }}>
                                {/* Card header */}
                                <div className="flex items-center justify-between mb-3" style={{ marginBottom: '0.75rem' }}>
                                    {editingId === p.id ? (
                                        <div
                                            className="flex items-center gap-2 w-full"
                                            onClick={e => e.preventDefault()}
                                            style={{ gap: '0.5rem' }}
                                        >
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                autoFocus
                                                style={{
                                                    flex: 1,
                                                    padding: '0.3rem 0.6rem',
                                                    fontSize: '0.85rem',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--brand-cyan)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: 0,
                                                }}
                                            />
                                            <button
                                                onClick={(e) => handleEditSave(p.id, e)}
                                                className="btn btn-success btn-icon"
                                                title="Save"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={handleEditCancel}
                                                className="btn btn-secondary btn-icon"
                                                title="Cancel"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2" style={{ gap: '0.6rem', flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                                    background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,255,136,0.08))',
                                                    border: '1px solid var(--border-accent)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    <FolderGit2 size={16} style={{ color: 'var(--brand-cyan)' }} />
                                                </div>
                                                <h3 style={{ margin: 0, fontSize: '1rem', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.name}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={(e) => handleEditStart(p, e)}
                                                className="btn btn-secondary btn-icon"
                                                title={t('dashboard.rename')}
                                                style={{ flexShrink: 0, opacity: 0.5 }}
                                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Meta */}
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 0, fontFamily: 'var(--font-mono)' }}>
                                    {t('dashboard.created')} {new Date(p.created_at).toLocaleDateString()}
                                </p>

                                {/* Footer */}
                                <div className="flex justify-end mt-4" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                                    <button
                                        onClick={(e) => handleDelete(p.id, e)}
                                        className="btn btn-danger btn-icon"
                                        title="Delete project"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
