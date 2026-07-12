/**
 * rotateMasterKey.js
 *
 * Rotates the MASTER KEY used to wrap every secret's data key.
 * This does NOT change any secret's plaintext value — only the
 * key used to protect its data key changes. Run this offline
 * (not as an API endpoint) because it needs both the old and new
 * master key in memory at once, which should never be exposed
 * over HTTP.
 *
 * Usage:
 *   OLD_MASTER_KEY=<64 hex chars> \
 *   NEW_MASTER_KEY=<64 hex chars> \
 *   DATABASE_URL=<your connection string> \
 *   node scripts/rotateMasterKey.js
 *
 * After it finishes successfully:
 *   1. Update MASTER_KEY in your .env / deployment secrets to the
 *      NEW_MASTER_KEY value.
 *   2. Restart the app.
 *   3. Only once you've confirmed the app is healthy, discard the
 *      old master key.
 *
 * The script processes rows one at a time inside its own
 * transaction-per-row so a failure partway through leaves already-
 * rotated rows correctly re-wrapped and unrotated rows untouched —
 * it's safe to re-run.
 */

require('dotenv').config();
const { Pool } = require('pg');
const {
  decryptDataKeyWithMasterKey,
  encryptDataKeyWithMasterKey,
} = require('../src/services/encryptionService');

function parseKey(hex, label) {
  if (!hex) {
    throw new Error(`${label} is not set`);
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error(`${label} must be a 32-byte value hex-encoded (64 hex characters)`);
  }
  return key;
}

async function main() {
  const oldKey = parseKey(process.env.OLD_MASTER_KEY, 'OLD_MASTER_KEY');
  const newKey = parseKey(process.env.NEW_MASTER_KEY, 'NEW_MASTER_KEY');

  if (oldKey.equals(newKey)) {
    throw new Error('OLD_MASTER_KEY and NEW_MASTER_KEY must be different');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows } = await pool.query(`SELECT id, encrypted_data_key FROM secrets`);
  console.log(`Found ${rows.length} secret(s) to re-wrap.`);

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const dataKey = decryptDataKeyWithMasterKey(row.encrypted_data_key, oldKey);
      const rewrapped = encryptDataKeyWithMasterKey(dataKey, newKey);

      await pool.query(`UPDATE secrets SET encrypted_data_key = $1 WHERE id = $2`, [
        rewrapped,
        row.id,
      ]);

      // Best-effort audit trail of the rotation itself. identity_id
      // is null because this is an offline maintenance action, not
      // tied to a logged-in identity.
      await pool.query(
        `INSERT INTO audit_log (identity_id, secret_id, action, result)
         VALUES (NULL, $1, 'master-key-rotate', 'allowed')`,
        [row.id],
      );

      succeeded += 1;
    } catch (err) {
      failed += 1;
      console.error(`Failed to rotate secret ${row.id}:`, err.message);
    }
  }

  console.log(`Done. ${succeeded} rotated, ${failed} failed.`);
  if (failed > 0) {
    console.error('Some secrets failed to rotate — do NOT discard the old master key yet.');
    process.exitCode = 1;
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Master key rotation failed:', err.message);
  process.exit(1);
});
