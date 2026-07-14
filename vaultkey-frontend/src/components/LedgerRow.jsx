import './LedgerRow.css';

function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortId(id) {
  if (!id) return '—';
  return id.slice(0, 8);
}

/**
 * Renders one audit_log row as a monospace ledger line, the way a
 * physical vault's paper access log would read it out:
 *   [14:32:07] backend-svc → read → app-config#f5dce7d4  allowed
 * This is the app's signature element — audit history should feel
 * like a real security ledger, not a generic admin table row.
 */
export default function LedgerRow({ entry }) {
  const isAllowed = entry.result === 'allowed';

  return (
    <div className="ledger-row">
      <span className="ledger-time mono">[{formatTimestamp(entry.timestamp)}]</span>
      <span className="ledger-identity mono">{entry.identity_name ?? 'system'}</span>
      <span className="ledger-arrow" aria-hidden="true">
        →
      </span>
      <span className="ledger-action mono">{entry.action}</span>
      <span className="ledger-arrow" aria-hidden="true">
        →
      </span>
      <span className="ledger-secret mono">{shortId(entry.secret_id)}</span>
      <span className={`badge ${isAllowed ? 'badge-allow' : 'badge-deny'} ledger-result`}>
        {entry.result}
      </span>
    </div>
  );
}
