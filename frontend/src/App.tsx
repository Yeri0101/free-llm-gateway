import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Layers, Globe, KeyRound, Home } from 'lucide-react';
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'es' : 'en');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    const username = localStorage.getItem('user') || 'admin';

    try {
      await fetchApi('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ username, currentPassword, newPassword })
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
        <div className="logo">
          <div className="logo-icon"><Layers size={20} /></div>
          {t('nav.title')}
        </div>
        <div className="flex items-center gap-4">
          {localStorage.getItem('token') && (
            <Link to="/" className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }} title="Go to Home">
              <Home size={16} />
            </Link>
          )}
          <button onClick={toggleLanguage} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Globe size={16} /> {language.toUpperCase()}
          </button>
          {localStorage.getItem('token') && (
            <>
              <button onClick={() => setShowPasswordModal(true)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} title={t('nav.change_password')}>
                <KeyRound size={16} />
              </button>
              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                {t('nav.logout')}
              </button>
            </>
          )}
        </div>
      </nav>
      <main className="app-container">
        {children}
      </main>

      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <KeyRound size={20} /> {t('settings.password_title')}
            </h3>

            {passwordError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{passwordError}</div>}
            {passwordSuccess && <div style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.9rem' }}>{passwordSuccess}</div>}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>{t('settings.current_password')}</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>{t('settings.new_password')}</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPasswordModal(false)}>
                  {t('settings.btn_cancel')}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={passwordLoading}>
                  {t('settings.btn_update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// Private route wrapper
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
