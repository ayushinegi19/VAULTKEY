const pool = require('../config/db');

/**
 * Writes a single append-only audit log entry. Called from every
 * secret access attempt — both allowed and denied — so audit_log
 * is a complete record of "who tried to access what, and what
 * happened", not just a log of successes.
 *
 * @param {string} identityId - identities.id of the caller (may be null for pre-auth events)
 * @param {string|null} secretId - secrets.id being accessed, or null if not applicable
 * @param {string} action - e.g. 'read', 'create'
 * @param {string} result - e.g. 'allowed', 'denied'
 */
async function writeAuditLog(identityId, secretId, action, result) {
  await pool.query(
    `INSERT INTO audit_log (identity_id, secret_id, action, result)
     VALUES ($1, $2, $3, $4)`,
    [identityId, secretId, action, result],
  );
}

module.exports = { writeAuditLog };
