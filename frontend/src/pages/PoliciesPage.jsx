import { useEffect, useState } from 'react';
import api from '../api/client';
import Notice from '../components/Notice';
import './SecretsPage.css';

const ACTIONS = ['read', 'update', 'rotate', 'delete'];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ role: '', resourceTag: '', action: 'read', effect: 'allow' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function load() {
    const result = await api.listPolicies();
    if (result.ok) setPolicies(result.data);
    else setError(result.data?.error || 'Failed to load policies');
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const result = await api.createPolicy(form);
    setCreating(false);

    if (!result.ok) {
      const details = result.data?.details?.map((d) => d.message).join('; ');
      setCreateError(details || result.data?.error || 'Failed to create policy');
      return;
    }

    setForm({ role: '', resourceTag: '', action: 'read', effect: 'allow' });
    setShowCreate(false);
    load();
  }

  async function handleDelete(id) {
    await api.deletePolicy(id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">Access control</span>
          <h1>Policies</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : 'New policy'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="panel create-form">
          <div className="create-form-grid">
            <div className="field">
              <label htmlFor="p-role">Role</label>
              <input
                id="p-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="service"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="p-tag">Resource tag</label>
              <input
                id="p-tag"
                value={form.resourceTag}
                onChange={(e) => setForm((f) => ({ ...f, resourceTag: e.target.value }))}
                placeholder="app-config"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="p-action">Action</label>
              <select
                id="p-action"
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="p-effect">Effect</label>
              <select
                id="p-effect"
                value={form.effect}
                onChange={(e) => setForm((f) => ({ ...f, effect: e.target.value }))}
              >
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
            </div>
          </div>

          <Notice tone="error">{createError}</Notice>

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create policy'}
          </button>
        </form>
      )}

      <Notice tone="error">{error}</Notice>

      <div className="panel">
        {policies === null ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="empty-state">
            <h3>No policies yet</h3>
            <p>Without a matching policy, every role is denied by default.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Resource tag</th>
                <th>Action</th>
                <th>Effect</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.role}</td>
                  <td>
                    <span className="badge badge-neutral mono">{p.resource_tag}</span>
                  </td>
                  <td className="mono">{p.action}</td>
                  <td>
                    <span className={`badge ${p.effect === 'allow' ? 'badge-allow' : 'badge-deny'}`}>
                      {p.effect}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => handleDelete(p.id)}>
                      Delete
                    </button>
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
