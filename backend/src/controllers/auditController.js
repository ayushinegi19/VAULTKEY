const pool = require('../config/db');

/**
 * Lists audit log entries, most recent first, with optional filters:
 *   ?identityId=<uuid>   only entries for this identity
 *   ?secretId=<uuid>     only entries for this secret
 *   ?action=read         only entries with this action
 *   ?result=denied        only entries with this result
 *   ?from=2026-01-01      only entries at/after this timestamp
 *   ?to=2026-12-31         only entries at/before this timestamp
 *   ?limit=50&offset=0     pagination (limit defaults to 200, capped at 200)
 */
async function listAuditLog(req, res) {
  const { identityId, secretId, action, result, from, to, offset } = req.query;
  let { limit } = req.query;

  limit = Math.min(parseInt(limit, 10) || 200, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (identityId) {
    conditions.push(`a.identity_id = $${paramIndex++}`);
    values.push(identityId);
  }
  if (secretId) {
    conditions.push(`a.secret_id = $${paramIndex++}`);
    values.push(secretId);
  }
  if (action) {
    conditions.push(`a.action = $${paramIndex++}`);
    values.push(action);
  }
  if (result) {
    conditions.push(`a.result = $${paramIndex++}`);
    values.push(result);
  }
  if (from) {
    conditions.push(`a.timestamp >= $${paramIndex++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`a.timestamp <= $${paramIndex++}`);
    values.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitParam = paramIndex++;
  values.push(parsedOffset);
  const offsetParam = paramIndex++;

  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.identity_id,
       i.name AS identity_name,
       a.secret_id,
       a.action,
       a.result,
       a.timestamp
     FROM audit_log a
     LEFT JOIN identities i ON i.id = a.identity_id
     ${whereClause}
     ORDER BY a.timestamp DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values,
  );

  res.json(rows);
}

module.exports = { listAuditLog };
