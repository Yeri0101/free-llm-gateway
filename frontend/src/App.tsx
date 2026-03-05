import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Layers, Globe, KeyRound, Home, LogOut, Zap, Shield, Activity } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { LanguageProvider, useLanguage } from './i18n';
import { fetchApi } from './api';
import './index.css';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { language, setLanguage, t } = useLanguage();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const isLoggedIn = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'es' : 'en');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);
    const username = localStorage.getItem('user') || 'admin';
    try {
      await fetchApi('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ username, currentPassword, newPassword }),
      });
      setPasswordSuccess(t('settings.success'));
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message || t('settings.error'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        {/* Logo */}
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <div className="logo-badge">
            <Layers size={18} />
          </div>
          <div className="logo-text">
            <span className="logo-name">OpenClaw</span>
            <span className="logo-sub">Gateway · SOAT</span>
          </div>
        </Link>

        {/* Center status — only when logged in */}
        {isLoggedIn && (
          <div className="flex items-center gap-3" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <div className="status-live">
              <div className="status-live-dot" />
              LIVE
            </div>
            <div className="flex items-center gap-2" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', gap: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={10} style={{ color: 'var(--brand-cyan)' }} />
                FALLBACK
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Shield size={10} style={{ color: 'var(--brand-green)' }} />
                ANTI-F200
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Activity size={10} style={{ color: 'var(--status-warning)' }} />
                LATENCY
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="navbar-actions">
          {isLoggedIn && (
            <Link
              to="/"
              className="btn btn-secondary btn-icon"
              title="Dashboard"
              style={{ textDecoration: 'none' }}
            >
              <Home size={16} />
            </Link>
          )}

          <button
            onClick={toggleLanguage}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.75rem', gap: '0.3rem', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            <Globe size={13} />
            {language.toUpperCase()}
          </button>

          {isLoggedIn && (
            <>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="btn btn-secondary btn-icon"
                title={t('nav.change_password')}
              >
                <KeyRound size={16} />
              </button>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-icon"
                title={t('nav.logout')}
                style={{ color: 'var(--status-error)', borderColor: 'rgba(248,113,113,0.2)' }}
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="app-container">
        {children}
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <KeyRound size={18} style={{ color: 'var(--brand-cyan)' }} />
                <h3 style={{ margin: 0 }}>{t('settings.password_title')}</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn btn-secondary btn-icon"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="alert alert-error">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="alert alert-success">{passwordSuccess}</div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>{t('settings.current_password')}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>{t('settings.new_password')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowPasswordModal(false)}
                >
                  {t('settings.btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={passwordLoading}
                >
                  {passwordLoading ? '...' : t('settings.btn_update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/projects/:id" element={<PrivateRoute><ProjectDetail /></PrivateRoute>} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;
