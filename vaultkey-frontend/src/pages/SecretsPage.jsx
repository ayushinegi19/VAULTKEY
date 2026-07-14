import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Notice from '../components/Notice';
import './SecretsPage.css';

export default function SecretsPage() {
  const [secrets, setSecrets] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', tag: '', value: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    setError('');
    const result = await api.listSecrets();
    if (result.ok) {
      setSecrets(result.data);
    } else {
      setError(result.data?.error || 'Failed to load secrets');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const result = await api.createSecret(form);

    setCreating(false);
    if (!result.ok) {
      const details = result.data?.details?.map((d) => d.message).join('; ');
      setCreateError(details || result.data?.error || 'Failed to create secret');
      return;
    }

    setForm({ name: '', tag: '', value: '' });
    setShowCreate(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">Vault</span>
          <h1>Secrets</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New secret'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="panel create-form">
          <div className="create-form-grid">
            <div className="field">
              <label htmlFor="s-name">Name</label>
              <input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="db-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="s-tag">Tag</label>
              <input
                id="s-tag"
                value={form.tag}
                onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                placeholder="app-config"
                required
              />
              <span className="hint">Policies grant access by tag, not by individual secret.</span>
            </div>
            <div className="field create-form-value">
              <label htmlFor="s-value">Value</label>
              <input
                id="s-value"
                type="password"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="the plaintext to encrypt"
                required
              />
            </div>
          </div>

          <Notice tone="error">{createError}</Notice>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Encrypting…' : 'Create secret'}
          </button>
        </form>
      )}

      <Notice tone="error">{error}</Notice>

      <div className="panel">
        {secrets === null ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : secrets.length === 0 ? (
          <div className="empty-state">
            <h3>No secrets visible to your role</h3>
            <p>Create one, or ask an admin to grant your role a policy on a resource tag.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tag</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {secrets.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <span className="badge badge-neutral mono">{s.tag}</span>
                  </td>
                  <td className="mono">{new Date(s.created_at).toLocaleString()}</td>
                  <td>
                    <Link to={`/secrets/${s.id}`} className="btn btn-ghost">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
