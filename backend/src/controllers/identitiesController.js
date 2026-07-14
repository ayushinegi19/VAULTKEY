const bcrypt = require('bcrypt');
const pool = require('../config/db');

const SALT_ROUNDS = 10;

// Validation of shape/strength now lives in src/validation/schemas.js
// (createIdentitySchema) and runs before this handler via the
// validate() middleware — req.body arrives here already checked.
async function createIdentity(req, res) {
  const { name, credential, role } = req.body;

  const hashedCredential = await bcrypt.hash(credential, SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO identities (name, hashed_credential, role)
     VALUES ($1, $2, $3)
     RETURNING id, name, role, created_at`,
    [name, hashedCredential, role],
  );

  res.status(201).json(rows[0]);
}

// Admin-only listing (Phase 3). Never returns hashed_credential.
async function listIdentities(req, res) {
  const { rows } = await pool.query(
    `SELECT id, name, role, created_at FROM identities ORDER BY created_at DESC`,
  );
  res.json(rows);
}

module.exports = { createIdentity, listIdentities };
