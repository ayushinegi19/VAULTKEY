import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import Notice from '../components/Notice';
import LedgerRow from '../components/LedgerRow';
import './SecretDetailPage.css';

export default function SecretDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [meta, setMeta] = useState(null);
  const [revealedValue, setRevealedValue] = useState(null);
  const [revealError, setRevealError] = useState('');
  const [revealing, setRevealing] = useState(false);

  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [ledger, setLedger] = useState(null);

  async function loadLedger() {
    const result = await api.listAudit({ secretId: id, limit: '25' });
    if (result.ok) setLedger(result.data);
  }

  // Metadata comes from the listing endpoint filtered client-side,
  // since there's no dedicated GET for metadata-only-by-id — the
  // value-bearing GET is RBAC-gated and audited, so we only call it
  // when the user explicitly clicks "Reveal".
  async function loadMeta() {
    const result = await api.listSecrets();
    if (result.ok) {
      const found = result.data.find((s) => s.id === id);
      setMeta(found || null);
    }
  }

  useEffect(() => {
    loadMeta();
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleReveal() {
    setRevealing(true);
    setRevealError('');
    const result = await api.getSecret(id);
    setRevealing(false);

    if (!result.ok) {
      setRevealError(result.data?.error || 'Could not reveal this secret');
      loadLedger();
      return;
    }
    setRevealedValue(result.data.value);
    loadLedger();
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const result = await api.updateSecret(id, { value: editValue });
    setSaving(false);

    if (!result.ok) {
      const details = result.data?.details?.map((d) => d.message).join('; ');
      setSaveError(details || result.data?.error || 'Update failed');
      return;
    }
    setSaveSuccess('Value updated and re-encrypted.');
    setEditValue('');
    setRevealedValue(null);
    loadLedger();
  }

  async function handleRotate() {
    setRotating(true);
    setSaveError('');
    setSaveSuccess('');

    const result = await api.rotateSecret(id);
    setRotating(false);

    if (!result.ok) {
      setSaveError(result.data?.error || 'Rotation failed');
      return;
    }
    setSaveSuccess('Re-encrypted under a fresh data key. Plaintext is unchanged.');
    loadLedger();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await api.deleteSecret(id);
    setDeleting(false);

    if (!result.ok) {
      setSaveError(result.data?.error || 'Delete failed');
      return;
    }
    navigate('/secrets');
  }

  if (meta === null) {
    return (
      <div className="empty-state">
        <h3>Secret not found</h3>
        <p>It may have been deleted, or your role can't see this resource tag.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <span className="badge badge-neutral mono">{meta.tag}</span>
          </span>
          <h1>{meta.name}</h1>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel detail-panel">
          <h2 className="panel-title">Value</h2>

          {revealedValue !== null ? (
            <div className="reveal-box">
              <code className="reveal-value mono">{revealedValue}</code>
              <button type="button" className="btn btn-ghost" onClick={() => setRevealedValue(null)}>
                Hide
              </button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={handleReveal} disabled={revealing}>
              {revealing ? 'Decrypting…' : 'Reveal value'}
            </button>
          )}

          <Notice tone="error">{revealError}</Notice>

          <div className="detail-divider" />

          <form onSubmit={handleUpdate} className="update-form">
            <div className="field">
              <label htmlFor="new-value">Set a new value</label>
              <input
                id="new-value"
                type="password"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="new plaintext to encrypt"
              />
            </div>
            <button type="submit" className="btn" disabled={saving || !editValue}>
              {saving ? 'Saving…' : 'Update value'}
            </button>
          </form>

          <Notice tone="error">{saveError}</Notice>
          <Notice tone="success">{saveSuccess}</Notice>

          <div className="detail-actions">
            <button type="button" className="btn" onClick={handleRotate} disabled={rotating}>
              {rotating ? 'Rotating…' : 'Rotate key'}
            </button>

            {confirmDelete ? (
              <>
                <span className="hint">Delete permanently from view?</span>
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
        </section>

        <section className="panel detail-panel">
          <h2 className="panel-title">Access ledger</h2>
          <div className="ledger">
            {ledger === null ? (
              <div className="empty-state">
                <p>Loading…</p>
              </div>
            ) : ledger.length === 0 ? (
              <div className="empty-state">
                <p>No access attempts recorded yet.</p>
              </div>
            ) : (
              ledger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
