const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const {
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshTokenById,
  revokeRefreshTokenByRawToken,
} = require('../services/refreshTokenService');

// Access tokens are now short-lived on purpose — the refresh token
// is what lets the client stay logged in without re-sending
// credentials, while limiting how long a stolen access token stays
// useful.
const ACCESS_TOKEN_TTL = '15m';

function signAccessToken(identity) {
  return jwt.sign(
    { sub: identity.id, role: identity.role, name: identity.name },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

async function login(req, res) {
  const { name, credential } = req.body;

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

  const accessToken = signAccessToken(identity);
  const refreshToken = await issueRefreshToken(identity.id);

  res.json({
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
    role: identity.role,
  });
}

/**
 * Exchanges a valid, unexpired, unrevoked refresh token for a new
 * access token AND a new refresh token (refresh token ROTATION —
 * the old refresh token is revoked in the same request, so a
 * refresh token can only ever be used once. If someone replays a
 * stolen-and-already-used refresh token, it will simply fail here).
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;

  const tokenRow = await findValidRefreshToken(refreshToken);
  if (!tokenRow) {
    return res.status(401).json({ error: 'Invalid, expired, or already-used refresh token' });
  }

  const { rows } = await pool.query(
    `SELECT id, name, role FROM identities WHERE id = $1`,
    [tokenRow.identity_id],
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Identity no longer exists' });
  }
  const identity = rows[0];

  // Rotate: revoke the token that was just used, issue a fresh one.
  await revokeRefreshTokenById(tokenRow.id);
  const newRefreshToken = await issueRefreshToken(identity.id);
  const accessToken = signAccessToken(identity);

  res.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
    role: identity.role,
  });
}

/**
 * Revokes a refresh token so it can no longer be used, even if it
 * hasn't expired yet. This is what "log out everywhere" is built
 * from (call it once per active refresh token for the identity).
 */
async function logout(req, res) {
  const { refreshToken } = req.body;
  await revokeRefreshTokenByRawToken(refreshToken);
  res.status(204).send();
}

module.exports = { login, refresh, logout };
