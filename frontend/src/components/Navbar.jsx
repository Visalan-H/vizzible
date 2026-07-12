import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/ThemeContext';
import './Navbar.css';

export default function Navbar() {
  const { user, setUser, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  function signOut() {
    // Optimistic - the cookie clear practically never fails, and there's
    // nothing useful to do in the UI if it did.
    setUser(null);
    client.post('/api/auth/logout').catch(() => {});
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo">
        DevHeat
      </Link>

      {!loading && (
        <div className="nav-user">
          <button className="btn-ghost" onClick={toggleTheme} style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }} title="Toggle Theme">
            {theme === 'system' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            )}
            {theme === 'dark' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
            {theme === 'light' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            )}
          </button>
          
          {user ? (
            <button className="btn-ghost" onClick={signOut}>
              Sign out
            </button>
          ) : (
            <a className="btn-primary" href={`${import.meta.env.VITE_API_URL}/api/auth/github`}>
              Sign in with GitHub
            </a>
          )}
        </div>
      )}
    </nav>
  );
}
