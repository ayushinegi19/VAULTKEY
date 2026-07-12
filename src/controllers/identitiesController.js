const bcrypt = require('bcrypt');
const pool = require('../config/db');

const SALT_ROUNDS = 10;
const VALID_ROLES = ['admin', 'service', 'user'];

async function createIdentity(req, res) {
  const { name, credential, role } = req.body;

  if (!name || !credential || !role) {
    return res.status(400).json({ error: 'name, credential, and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  if (credential.length < 8) {
    return res.status(400).json({ error: 'credential must be at least 8 characters' });
  }

  const hashedCredential = await bcrypt.hash(credential, SALT_ROUNDS);

  const { rows } = await pool.query(
    `INSERT INTO identities (name, hashed_credential, role)
     VALUES ($1, $2, $3)
     RETURNING id, name, role, created_at`,
    [name, hashedCredential, role],
  );

  res.status(201).json(rows[0]);
}

module.exports = { createIdentity };
