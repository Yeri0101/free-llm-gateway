import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../api';
import { FolderGit2, Plus, Trash2, Edit2, Check, X, Settings, LogOut } from 'lucide-react';
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

    useEffect(() => {
        loadProjects();
    }, []);

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
                body: JSON.stringify({ name: editName })
            });
            setEditingId(null);
            loadProjects();
        } catch (err) {
            alert('Failed to rename project');
        }
    };

    /**
     * handleUpdateCredentials
     * Submits the new credentials struct to the backend API.
     * If successful, instantly clears the local token and forces a relogin 
     * using the new credentials for security purposes.
     */
    const handleUpdateCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetchApi('/auth/credentials', {
                method: 'PUT',
                body: JSON.stringify(credsForm)
            });
            alert('Credentials updated successfully. Please log in again.');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err: any) {
            alert(err.message || 'Failed to update credentials. Please check your current password.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.subtitle')}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowSettings(true)} className="btn" title="Settings">
                        <Settings size={20} />
                    </button>
                    <button onClick={handleLogout} className="btn btn-danger" title="Logout">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {showSettings && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="glass-panel" style={{ width: '400px', maxWidth: '90%' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2>⚙️ Update Credentials</h2>
                            <button onClick={() => setShowSettings(false)} className="btn" style={{ background: 'transparent' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateCredentials} className="flex flex-col gap-4">
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px' }}>Current Username</label>
                                <input type="text" value={credsForm.currentUsername} onChange={e => setCredsForm({ ...credsForm, currentUsername: e.target.value })} required className="w-full" style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px' }}>Current Password</label>
                                <input type="password" value={credsForm.currentPassword} onChange={e => setCredsForm({ ...credsForm, currentPassword: e.target.value })} required style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px' }}>New Username (optional)</label>
                                <input type="text" value={credsForm.newUsername} onChange={e => setCredsForm({ ...credsForm, newUsername: e.target.value })} style={{ width: '100%' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '4px' }}>New Password (optional)</label>
                                <input type="password" value={credsForm.newPassword} onChange={e => setCredsForm({ ...credsForm, newPassword: e.target.value })} style={{ width: '100%' }} />
                            </div>
                            <button type="submit" className="btn btn-primary mt-2">Update & Relogin</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="glass-panel mb-8">
                <h3>{t('dashboard.create_title')}</h3>
                <p>{t('dashboard.create_desc')}</p>
                <form onSubmit={handleCreate} className="flex gap-4 mt-4 items-center">
                    <div style={{ flex: 1 }}>
                        <input
                            type="text"
                            placeholder={t('dashboard.input_placeholder')}
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        <Plus size={18} /> {t('dashboard.btn_create')}
                    </button>
                </form>
            </div>

            <div className="grid">
                {projects.length === 0 ? (
                    <div className="glass-panel text-center" style={{ gridColumn: '1 / -1', padding: '4rem 2rem' }}>
                        <FolderGit2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <h3>{t('dashboard.no_projects')}</h3>
                        <p>{t('dashboard.no_projects_desc')}</p>
                    </div>
                ) : (
                    projects.map(p => (
                        <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                            <div className="card h-full justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        {editingId === p.id ? (
                                            <div className="flex items-center gap-2 w-full" onClick={e => e.preventDefault()}>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    autoFocus
                                                    style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', color: 'white', borderRadius: '4px', flex: 1 }}
                                                />
                                                <button onClick={(e) => handleEditSave(p.id, e)} className="btn btn-primary" style={{ padding: '0.4rem', borderRadius: '4px' }} title={t('dashboard.save')}>
                                                    <Check size={16} />
                                                </button>
                                                <button onClick={handleEditCancel} className="btn" style={{ padding: '0.4rem', borderRadius: '4px', background: 'var(--bg-tertiary)' }} title="Cancel">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <FolderGit2 size={24} style={{ color: 'var(--accent-primary)' }} />
                                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{p.name}</h3>
                                                </div>
                                                <button onClick={(e) => handleEditStart(p, e)} className="btn" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--text-secondary)' }} title={t('dashboard.rename')}>
                                                    <Edit2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.85rem' }}>
                                        {t('dashboard.created')} {new Date(p.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={(e) => handleDelete(p.id, e)}
                                        className="btn btn-danger"
                                        style={{ padding: '0.5rem', borderRadius: '6px' }}
                                        title="Delete project"
                                    >
                                        <Trash2 size={16} />
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
