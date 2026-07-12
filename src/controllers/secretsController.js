const pool = require('../config/db');
const { encryptSecret, decryptSecret } = require('../services/encryptionService');
const { checkPolicy } = require('../middleware/rbac');
const { writeAuditLog } = require('../services/auditService');

async function createSecret(req, res) {
  const { name, tag, value } = req.body;

  if (!name || !tag || value === undefined) {
    return res.status(400).json({ error: 'name, tag, and value are required' });
  }

  const { encryptedValue, encryptedDataKey, iv, authTag } = encryptSecret(value);

  const { rows } = await pool.query(
    `INSERT INTO secrets (name, tag, encrypted_value, encrypted_data_key, iv, auth_tag)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, tag, created_at`,
    [name, tag, encryptedValue, encryptedDataKey, iv, authTag],
  );

  // Secret creation itself is audited too, for full traceability,
  // though RBAC gating currently applies to reads (see spec).
  await writeAuditLog(req.identity.id, rows[0].id, 'create', 'allowed');

  res.status(201).json(rows[0]);
}

async function getSecret(req, res) {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT id, name, tag, encrypted_value, encrypted_data_key, iv, auth_tag
     FROM secrets WHERE id = $1`,
    [id],
  );

  if (rows.length === 0) {
    // Nothing to audit against a secret id that doesn't exist, but
    // we still note the attempt against no specific secret row.
    await writeAuditLog(req.identity.id, null, 'read', 'denied');
    return res.status(404).json({ error: 'Secret not found' });
  }

  const secret = rows[0];
  const decision = await checkPolicy(req.identity.role, secret.tag, 'read');

  if (decision === 'deny') {
    await writeAuditLog(req.identity.id, secret.id, 'read', 'denied');
    return res.status(403).json({ error: 'Forbidden: policy denies this role read access to this resource' });
  }

  const plaintext = decryptSecret(secret);
  await writeAuditLog(req.identity.id, secret.id, 'read', 'allowed');

  res.json({
    id: secret.id,
    name: secret.name,
    tag: secret.tag,
    value: plaintext,
  });
}

module.exports = { createSecret, getSecret };
