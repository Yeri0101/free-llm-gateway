import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../api';
import { Layers, ArrowRight, Lock, User } from 'lucide-react';
import { useLanguage } from '../i18n';

export default function Login() {
    const { t } = useLanguage();
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
            localStorage.setItem('user', res.user || username);
            navigate('/');
        } catch (err: any) {
            setError(err.message || t('login.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '85vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>

                {/* Logo block */}
                <div className="text-center mb-8" style={{ marginBottom: '2.5rem' }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 'var(--radius-lg)',
                        background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,136,0.1))',
                        border: '1px solid var(--border-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        boxShadow: '0 8px 32px rgba(0, 212, 255, 0.2)',
                    }}>
                        <Layers size={30} style={{ color: 'var(--brand-cyan)' }} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>OpenClaw Gateway</h1>
                    <div className="soat-pill" style={{ margin: '0 auto 0.75rem', width: 'fit-content' }}>
                        SOAT Control Center
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 0 }}>
                        {t('login.subtitle')}
                    </p>
                </div>

                {/* Card */}
                <div className="glass-panel panel-accent">
                    {error && (
                        <div className="alert alert-error mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <User size={11} /> Username
                                </span>
                            </label>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="admin"
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Lock size={11} /> {t('login.password')}
                                </span>
                            </label>
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        <button
                            id="login-submit"
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={loading}
                            style={{ padding: '0.85rem', fontSize: '0.95rem', gap: '0.5rem' }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="spinner-ring" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    {t('login.btn_signing_in')}
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {t('login.btn_signin')} <ArrowRight size={16} />
                                </span>
                            )}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '1.5rem', fontFamily: 'var(--font-mono)' }}>
                    SOAT · Fallback · Cache · Latency Guard · PromptAnchor
                </p>
            </div>
        </div>
    );
}
