import { useEffect, useState } from 'react';
import api from '../api/client';
import Notice from '../components/Notice';
import './SecretsPage.css';

const ROLES = ['admin', 'service', 'user'];

export default function IdentitiesPage() {
  const [identities, setIdentities] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', credential: '', role: 'service' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    const result = await api.listIdentities();
    if (result.ok) setIdentities(result.data);
    else setError(result.data?.error || 'Failed to load identities');
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const result = await api.createIdentity(form);
    setCreating(false);

    if (!result.ok) {
      const details = result.data?.details?.map((d) => d.message).join('; ');
      setCreateError(details || result.data?.error || 'Failed to create identity');
      return;
    }

    setForm({ name: '', credential: '', role: 'service' });
    setShowCreate(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">Principals</span>
          <h1>Identities</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New identity'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="panel create-form">
          <div className="create-form-grid">
            <div className="field">
              <label htmlFor="i-name">Name</label>
              <input
                id="i-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="reporting-svc"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="i-role">Role</label>
              <select
                id="i-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field create-form-value">
              <label htmlFor="i-credential">Credential</label>
              <input
                id="i-credential"
                type="password"
                value={form.credential}
                onChange={(e) => setForm((f) => ({ ...f, credential: e.target.value }))}
                placeholder="12+ chars, upper, lower, digit, symbol"
                required
              />
            </div>
          </div>

          <Notice tone="error">{createError}</Notice>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create identity'}
          </button>
        </form>
      )}

      <Notice tone="error">{error}</Notice>

      <div className="panel">
        {identities === null ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.name}</td>
                  <td>
                    <span className={`badge ${i.role === 'admin' ? 'badge-allow' : 'badge-neutral'}`}>
                      {i.role}
                    </span>
                  </td>
                  <td className="mono">{new Date(i.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
