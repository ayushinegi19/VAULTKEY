import { useEffect, useState } from 'react';
import api from '../api/client';
import Notice from '../components/Notice';
import LedgerRow from '../components/LedgerRow';
import './AuditPage.css';

export default function AuditPage() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ action: '', result: '' });

  async function load(activeFilters) {
    setError('');
    const params = {};
    if (activeFilters.action) params.action = activeFilters.action;
    if (activeFilters.result) params.result = activeFilters.result;

    const result = await api.listAudit(params);
    if (result.ok) setEntries(result.data);
    else setError(result.data?.error || 'Failed to load audit log');
  }

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e) {
    e.preventDefault();
    load(filters);
  }

  function clearFilters() {
    const cleared = { action: '', result: '' };
    setFilters(cleared);
    load(cleared);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <span className="eyebrow">Append-only</span>
          <h1>Audit log</h1>
        </div>
      </div>

      <form onSubmit={applyFilters} className="panel audit-filters">
        <div className="field">
          <label htmlFor="f-action">Action</label>
          <select
            id="f-action"
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          >
            <option value="">any</option>
            <option value="read">read</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="rotate">rotate</option>
            <option value="delete">delete</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-result">Result</label>
          <select
            id="f-result"
            value={filters.result}
            onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
          >
            <option value="">any</option>
            <option value="allowed">allowed</option>
            <option value="denied">denied</option>
          </select>
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearFilters}>
          Clear
        </button>
      </form>

      <Notice tone="error">{error}</Notice>

      <div className="panel ledger">
        {entries === null ? (
          <div className="empty-state">
            <p>Loading…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <h3>No matching entries</h3>
            <p>Every read, write, rotation, and denial appears here the moment it happens.</p>
          </div>
        ) : (
          entries.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
