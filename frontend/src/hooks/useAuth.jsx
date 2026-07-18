import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

// Fetches the signed-in user once (or null, which is an expected logged-out
// state, not an error) and shares it across the app - Navbar, and Profile's
// "is this my own page" check both need it, and neither should trigger its
// own /api/auth/me request.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/api/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, setUser, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components, react-doctor/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
