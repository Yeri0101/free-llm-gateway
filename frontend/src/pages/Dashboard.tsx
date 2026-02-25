import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../api';
import { FolderGit2, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
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

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.subtitle')}</p>
                </div>
            </div>

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
