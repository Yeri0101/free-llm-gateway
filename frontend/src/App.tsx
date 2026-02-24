import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import './index.css';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <>
      <nav className="navbar">
        <div className="logo">
          <div className="logo-icon"><Layers size={20} /></div>
          OpenClaw Gateway
        </div>
        {localStorage.getItem('token') && (
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
            Logout
          </button>
        )}
      </nav>
      <main className="app-container">
        {children}
      </main>
    </>
  );
};

// Private route wrapper
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/projects/:id" element={<PrivateRoute><ProjectDetail /></PrivateRoute>} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
