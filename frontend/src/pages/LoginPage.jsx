import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Notice from '../components/Notice';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(name, credential);

    setLoading(false);
    if (!result.ok) {
      setError(result.data?.error || 'Invalid credentials');
      return;
    }
    navigate('/secrets');
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="login-mark" aria-hidden="true" />
        <h1 className="login-title">VaultKey</h1>
        <p className="eyebrow login-subtitle">Sign in to access the vault</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="name">Identity</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="credential">Credential</label>
            <input
              id="credential"
              type="password"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <Notice tone="error">{error}</Notice>

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
