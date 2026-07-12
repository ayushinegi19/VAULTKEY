/**
 * encryptionService.js
 *
 * Implements envelope encryption for secrets at rest, using
 * AES-256-GCM throughout (authenticated encryption — it gives us
 * both confidentiality and tamper detection).
 *
 * ── The mental model ──────────────────────────────────────────
 *
 * We never encrypt secret values directly with one long-lived
 * master key. Instead:
 *
 *   1. Every secret gets its OWN randomly generated "data key"
 *      (generateDataKey). The secret's plaintext is encrypted
 *      with that one-time data key (encryptWithKey).
 *
 *   2. The data key itself is then encrypted ("wrapped") using a
 *      single long-lived "master key" that lives only in server
 *      memory, loaded from the MASTER_KEY env var
 *      (encryptDataKeyWithMasterKey).
 *
 *   3. We store the encrypted secret AND the encrypted data key
 *      in the database. We never store a plaintext data key or a
 *      plaintext secret.
 *
 * Why bother with two layers instead of just encrypting every
 * secret directly with the master key?
 *
 *   - Blast radius: if one data key is ever compromised, only the
 *     single secret it protects is exposed — not every secret in
 *     the system.
 *   - Key rotation: to rotate the master key, you only need to
 *     re-wrap the (small) data keys, not re-encrypt every secret
 *     value from scratch.
 *   - This is the same pattern used by AWS KMS, Google Cloud KMS,
 *     and HashiCorp Vault's "transit" engine — it's worth knowing
 *     cold for an interview.
 *
 * ── AES-256-GCM specifics ─────────────────────────────────────
 *
 * GCM needs three things to decrypt correctly:
 *   - the key (32 bytes for AES-256)
 *   - the IV / nonce (12 bytes is the recommended size for GCM —
 *     it must never be reused with the same key)
 *   - the auth tag (16 bytes, produced when encryption finishes;
 *     verified when decryption starts — if it doesn't match, the
 *     ciphertext was tampered with or the wrong key/IV was used,
 *     and Node throws instead of silently returning garbage)
 *
 * A fresh random IV is generated for every single encryption call
 * (both for secret values and for wrapping data keys), which is
 * what makes reusing the same key across many secrets safe.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended IV length for GCM
const DATA_KEY_LENGTH_BYTES = 32; // 256-bit data key

function getMasterKey() {
  const masterKeyHex = process.env.MASTER_KEY;
  if (!masterKeyHex) {
    throw new Error('MASTER_KEY is not set. Copy .env.example to .env and fill it in.');
  }
  const masterKey = Buffer.from(masterKeyHex, 'hex');
  if (masterKey.length !== 32) {
    throw new Error('MASTER_KEY must be a 32-byte value hex-encoded (64 hex characters).');
  }
  return masterKey;
}

/**
 * Generates a brand new random 256-bit data key.
 * One of these is created per-secret, never reused.
 */
function generateDataKey() {
  return crypto.randomBytes(DATA_KEY_LENGTH_BYTES);
}

/**
 * Encrypts `plaintext` (a string) with the given raw AES key.
 * Returns everything needed to later decrypt it: the ciphertext,
 * the IV used, and the GCM auth tag — all base64-encoded so they
 * are safe to store as TEXT columns.
 */
function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Reverses encryptWithKey. Throws if the auth tag doesn't verify
 * (tampered ciphertext, wrong key, or wrong IV) — this is GCM
 * protecting us from silently decrypting corrupted/forged data.
 */
function decryptWithKey(ciphertext, key, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * "Wraps" a raw data key by encrypting it with the master key.
 * Because our `secrets` table only has a single iv/auth_tag pair
 * (reserved for the encrypted secret VALUE), the data key's own
 * iv + auth tag are packed into this one string, colon-delimited:
 *
 *   base64(iv) : base64(authTag) : base64(ciphertext)
 *
 * That whole packed string is what gets stored in the
 * secrets.encrypted_data_key column.
 */
function encryptDataKeyWithMasterKey(dataKey) {
  const masterKey = getMasterKey();
  const { ciphertext, iv, authTag } = encryptWithKey(dataKey.toString('base64'), masterKey);
  return `${iv}:${authTag}:${ciphertext}`;
}

/**
 * Reverses encryptDataKeyWithMasterKey: unpacks the iv/authTag/
 * ciphertext, decrypts with the master key, and returns the raw
 * data key as a Buffer (ready to pass into decryptWithKey).
 */
function decryptDataKeyWithMasterKey(encryptedDataKey) {
  const masterKey = getMasterKey();
  const parts = encryptedDataKey.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted_data_key — expected iv:authTag:ciphertext');
  }
  const [iv, authTag, ciphertext] = parts;
  const dataKeyBase64 = decryptWithKey(ciphertext, masterKey, iv, authTag);
  return Buffer.from(dataKeyBase64, 'base64');
}

/**
 * High-level entry point used when CREATING a secret.
 * Ties the whole envelope encryption flow together:
 *   1. mint a fresh one-time data key
 *   2. encrypt the plaintext secret with that data key
 *   3. wrap (encrypt) the data key with the master key
 * Returns exactly the four fields the `secrets` table expects.
 */
function encryptSecret(plaintext) {
  const dataKey = generateDataKey();
  const { ciphertext, iv, authTag } = encryptWithKey(plaintext, dataKey);
  const encryptedDataKey = encryptDataKeyWithMasterKey(dataKey);

  return {
    encryptedValue: ciphertext,
    encryptedDataKey,
    iv,
    authTag,
  };
}

/**
 * High-level entry point used when READING a secret.
 * Takes a DB row (or any object with the same four fields) and
 * returns the plaintext value, reversing encryptSecret exactly:
 *   1. unwrap the data key using the master key
 *   2. use that recovered data key to decrypt the secret value
 */
function decryptSecret(record) {
  const dataKey = decryptDataKeyWithMasterKey(record.encrypted_data_key);
  return decryptWithKey(record.encrypted_value, dataKey, record.iv, record.auth_tag);
}

module.exports = {
  generateDataKey,
  encryptWithKey,
  decryptWithKey,
  encryptDataKeyWithMasterKey,
  decryptDataKeyWithMasterKey,
  encryptSecret,
  decryptSecret,
};
