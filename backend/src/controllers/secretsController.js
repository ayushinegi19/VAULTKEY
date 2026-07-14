const pool = require('../config/db');
const { encryptSecret, decryptSecret } = require('../services/encryptionService');
const { checkPolicy } = require('../middleware/rbac');
const { writeAuditLog } = require('../services/auditService');

// Shape/required-field validation for create/update now lives in
// src/validation/schemas.js and runs via the validate() middleware
// before these handlers execute.

async function createSecret(req, res) {
  const { name, tag, value } = req.body;

  const { encryptedValue, encryptedDataKey, iv, authTag } = encryptSecret(value);

  const { rows } = await pool.query(
    `INSERT INTO secrets (name, tag, encrypted_value, encrypted_data_key, iv, auth_tag)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, tag, created_at`,
    [name, tag, encryptedValue, encryptedDataKey, iv, authTag],
  );

  await writeAuditLog(req.identity.id, rows[0].id, 'create', 'allowed');

  res.status(201).json(rows[0]);
}

async function getSecret(req, res) {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT id, name, tag, encrypted_value, encrypted_data_key, iv, auth_tag
     FROM secrets WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );

  if (rows.length === 0) {
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

/**
 * Lists secret METADATA ONLY — never decrypted values, never even
 * the ciphertext columns. Admins see everything; every other role
 * sees only secrets whose tag they have at least one 'allow' policy
 * on (for any action) — enough to know the resource exists and is
 * theirs to work with, without granting blanket read access.
 */
async function listSecrets(req, res) {
  const { role } = req.identity;

  if (role === 'admin') {
    const { rows } = await pool.query(
      `SELECT id, name, tag, created_at FROM secrets WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );
    return res.json(rows);
  }

  const { rows: allowedTagRows } = await pool.query(
    `SELECT DISTINCT resource_tag FROM policies WHERE role = $1 AND effect = 'allow'`,
    [role],
  );
  const allowedTags = allowedTagRows.map((r) => r.resource_tag);

  if (allowedTags.length === 0) {
    return res.json([]);
  }

  const { rows } = await pool.query(
    `SELECT id, name, tag, created_at FROM secrets
     WHERE deleted_at IS NULL AND tag = ANY($1::text[])
     ORDER BY created_at DESC`,
    [allowedTags],
  );
  res.json(rows);
}

/**
 * Updates a secret's name/tag, and/or re-encrypts it with a brand
 * new data key if a new value is supplied. Gated on the 'update'
 * action so it's governed by the same allow/deny policy engine as
 * everything else, and every attempt (allowed or denied) is audited.
 */
async function updateSecret(req, res) {
  const { id } = req.params;
  const { name, tag, value } = req.body;

  const { rows } = await pool.query(
    `SELECT id, tag FROM secrets WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (rows.length === 0) {
    await writeAuditLog(req.identity.id, null, 'update', 'denied');
    return res.status(404).json({ error: 'Secret not found' });
  }
  const existing = rows[0];

  const decision = await checkPolicy(req.identity.role, existing.tag, 'update');
  if (decision === 'deny') {
    await writeAuditLog(req.identity.id, existing.id, 'update', 'denied');
    return res.status(403).json({ error: 'Forbidden: policy denies this role update access to this resource' });
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (tag !== undefined) {
    fields.push(`tag = $${paramIndex++}`);
    values.push(tag);
  }
  if (value !== undefined) {
    const { encryptedValue, encryptedDataKey, iv, authTag } = encryptSecret(value);
    fields.push(`encrypted_value = $${paramIndex++}`);
    values.push(encryptedValue);
    fields.push(`encrypted_data_key = $${paramIndex++}`);
    values.push(encryptedDataKey);
    fields.push(`iv = $${paramIndex++}`);
    values.push(iv);
    fields.push(`auth_tag = $${paramIndex++}`);
    values.push(authTag);
  }

  values.push(id);
  const { rows: updatedRows } = await pool.query(
    `UPDATE secrets SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, name, tag, created_at`,
    values,
  );

  await writeAuditLog(req.identity.id, id, 'update', 'allowed');
  res.json(updatedRows[0]);
}

/**
 * Re-encrypts a secret's value under a brand new one-time data key
 * WITHOUT changing the plaintext — i.e. key rotation, not a value
 * change. Useful on a schedule ("rotate every 90 days") independent
 * of whether the secret content itself needs to change.
 */
async function rotateSecret(req, res) {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT id, tag, encrypted_value, encrypted_data_key, iv, auth_tag
     FROM secrets WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (rows.length === 0) {
    await writeAuditLog(req.identity.id, null, 'rotate', 'denied');
    return res.status(404).json({ error: 'Secret not found' });
  }
  const secret = rows[0];

  const decision = await checkPolicy(req.identity.role, secret.tag, 'rotate');
  if (decision === 'deny') {
    await writeAuditLog(req.identity.id, secret.id, 'rotate', 'denied');
    return res.status(403).json({ error: 'Forbidden: policy denies this role rotate access to this resource' });
  }

  // Decrypt under the OLD data key, then re-encrypt under a fresh one.
  const plaintext = decryptSecret(secret);
  const { encryptedValue, encryptedDataKey, iv, authTag } = encryptSecret(plaintext);

  const { rows: updatedRows } = await pool.query(
    `UPDATE secrets
     SET encrypted_value = $1, encrypted_data_key = $2, iv = $3, auth_tag = $4
     WHERE id = $5
     RETURNING id, name, tag, created_at`,
    [encryptedValue, encryptedDataKey, iv, authTag, id],
  );

  await writeAuditLog(req.identity.id, id, 'rotate', 'allowed');
  res.json(updatedRows[0]);
}

/**
 * Soft delete: marks deleted_at instead of removing the row. The
 * secret disappears from list/read immediately, but the row (and
 * every audit_log entry that ever referenced it) stays intact —
 * you can still answer "did this secret exist, and who touched it"
 * after it's gone.
 */
async function deleteSecret(req, res) {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT id, tag FROM secrets WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (rows.length === 0) {
    await writeAuditLog(req.identity.id, null, 'delete', 'denied');
    return res.status(404).json({ error: 'Secret not found' });
  }
  const secret = rows[0];

  const decision = await checkPolicy(req.identity.role, secret.tag, 'delete');
  if (decision === 'deny') {
    await writeAuditLog(req.identity.id, secret.id, 'delete', 'denied');
    return res.status(403).json({ error: 'Forbidden: policy denies this role delete access to this resource' });
  }

  await pool.query(`UPDATE secrets SET deleted_at = now() WHERE id = $1`, [id]);
  await writeAuditLog(req.identity.id, id, 'delete', 'allowed');
  res.status(204).send();
}

module.exports = {
  createSecret,
  getSecret,
  listSecrets,
  updateSecret,
  rotateSecret,
  deleteSecret,
};
