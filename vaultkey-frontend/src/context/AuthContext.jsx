import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

/**
 * Identity shape kept in state: { name, role }, decoded from the
 * access token's JWT payload (for display only — every real
 * authorization decision happens server-side, not here).
 */
export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [status, setStatus] = useState('checking'); // checking | authed | anon

  useEffect(() => {
    const storedRefreshToken = localStorage.getItem('vaultkey_refresh_token');

    api.configure({
      accessToken: null,
      refreshToken: storedRefreshToken,
      onAuthLostCallback: () => {
        setIdentity(null);
        setStatus('anon');
      },
    });

    if (!storedRefreshToken) {
      setStatus('anon');
      return;
    }

    (async () => {
      const result = await api.refreshSession();
      if (result.ok && result.identity) {
        setIdentity(result.identity);
        setStatus('authed');
      } else {
        setStatus('anon');
      }
    })();
  }, []);

  async function login(name, credential) {
    const result = await api.login(name, credential);
    if (result.ok) {
      api.setTokens({ accessToken: result.data.accessToken, refreshToken: result.data.refreshToken });
      const payload = api.decodeJwtPayload(result.data.accessToken);
      setIdentity({ name: payload?.name ?? name, role: result.data.role });
      setStatus('authed');
    }
    return result;
  }

  async function logout() {
    await api.logout();
    api.clearTokens();
    setIdentity(null);
    setStatus('anon');
  }

  const value = useMemo(() => ({ identity, status, login, logout }), [identity, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
