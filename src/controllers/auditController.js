const pool = require('../config/db');

async function listAuditLog(req, res) {
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
     ORDER BY a.timestamp DESC
     LIMIT 200`,
  );

  res.json(rows);
}

module.exports = { listAuditLog };
