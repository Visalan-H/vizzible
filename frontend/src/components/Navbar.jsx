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
        Vizzible
      </Link>

      {!loading && (
        <div className="nav-user">
          <button type="button" className="btn-ghost theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          
          {user && (
            <button type="button" className="btn-ghost" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
