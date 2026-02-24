import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../api';
import { Layers } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetchApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            localStorage.setItem('token', res.token);
            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center" style={{ marginTop: '10vh' }}>
            <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem' }}>
                <div className="text-center mb-8">
                    <div className="logo-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1rem' }}>
                        <Layers size={28} />
                    </div>
                    <h2>Admin Login</h2>
                    <p>Sign in to manage API routing</p>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="admin"
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2rem' }}>
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
