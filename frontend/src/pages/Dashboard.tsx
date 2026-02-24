import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../api';
import { FolderGit2, Plus, Trash2 } from 'lucide-react';

type Project = {
    id: string;
    name: string;
    created_at: string;
};

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [loading, setLoading] = useState(true);

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
        e.preventDefault(); // Prevent navigating to project
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await fetchApi(`/projects/${id}`, { method: 'DELETE' });
            loadProjects();
        } catch (err) {
            alert('Failed to delete project');
        }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1>Projects</h1>
                    <p>Manage your OpenClaw API gateways and agents</p>
                </div>
            </div>

            <div className="glass-panel mb-8">
                <h3>Create New Project</h3>
                <p>A project groups your Upstream API keys (Groq, OpenRouter) and Gateway keys.</p>
                <form onSubmit={handleCreate} className="flex gap-4 mt-4 items-center">
                    <div style={{ flex: 1 }}>
                        <input
                            type="text"
                            placeholder="e.g. Agencia Principal"
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary">
                        <Plus size={18} /> Create
                    </button>
                </form>
            </div>

            <div className="grid">
                {projects.length === 0 ? (
                    <div className="glass-panel text-center" style={{ gridColumn: '1 / -1', padding: '4rem 2rem' }}>
                        <FolderGit2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                        <h3>No projects yet</h3>
                        <p>Create your first project above to get started.</p>
                    </div>
                ) : (
                    projects.map(p => (
                        <Link to={`/projects/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                            <div className="card h-full justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <FolderGit2 size={24} style={{ color: 'var(--accent-primary)' }} />
                                        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{p.name}</h3>
                                    </div>
                                    <p style={{ fontSize: '0.85rem' }}>
                                        Created: {new Date(p.created_at).toLocaleDateString()}
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
