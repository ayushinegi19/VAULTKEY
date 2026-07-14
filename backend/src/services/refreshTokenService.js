const crypto = require('crypto');
const pool = require('../config/db');

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_TOKEN_BYTES = 40;

/**
 * We never store the raw refresh token — only a SHA-256 hash of
 * it, the same principle as password hashing. SHA-256 (not bcrypt)
 * is appropriate here because the token itself is already a large
 * random value (not a low-entropy human password), so we don't
 * need bcrypt's deliberate slowness — we need fast, exact lookups.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Mints a new refresh token for an identity and stores its hash.
 * Returns the RAW token — this is the only time it ever exists in
 * plaintext; the caller must hand it to the client immediately.
 */
async function issueRefreshToken(identityId) {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await pool.query(
    `INSERT INTO refresh_tokens (identity_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [identityId, tokenHash, expiresAt],
  );

  return rawToken;
}

/**
 * Looks up a raw refresh token. Returns the matching row if it
 * exists, isn't revoked, and hasn't expired — otherwise null.
 */
async function findValidRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const { rows } = await pool.query(
    `SELECT id, identity_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return row;
}

async function revokeRefreshTokenById(id) {
  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [id]);
}

async function revokeRefreshTokenByRawToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
}

module.exports = {
  issueRefreshToken,
  findValidRefreshToken,
  revokeRefreshTokenById,
  revokeRefreshTokenByRawToken,
};
