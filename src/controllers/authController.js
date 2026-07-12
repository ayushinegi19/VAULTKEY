const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const TOKEN_TTL = '1h';

async function login(req, res) {
  const { name, credential } = req.body;

  if (!name || !credential) {
    return res.status(400).json({ error: 'name and credential are required' });
  }

  const { rows } = await pool.query(
    `SELECT id, name, hashed_credential, role FROM identities WHERE name = $1`,
    [name],
  );

  // Deliberately generic error message and constant-shape check so
  // we don't reveal whether the identity name exists.
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const identity = rows[0];
  const isValid = await bcrypt.compare(credential, identity.hashed_credential);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: identity.id, role: identity.role, name: identity.name },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );

  res.json({ token, expiresIn: TOKEN_TTL, role: identity.role });
}

module.exports = { login };
