/**
 * Plain-Node end-to-end smoke test (no test framework required).
 *
 * Prerequisites:
 *   - Postgres running, schema.sql and seed.sql already applied
 *   - The VaultKey server running (npm start) in a separate terminal
 *
 * Run with: npm test   (or: node tests/test.js)
 *
 * What it proves, step by step:
 *   1. Both seeded identities can log in and receive a JWT
 *   2. An authenticated identity can create a secret (envelope-encrypted)
 *   3. The identity whose role IS permitted by policy can read it back
 *      and gets the correct plaintext (allow path)
 *   4. The identity whose role is NOT permitted by policy is denied
 *      with a 403 (deny path, fail-closed default)
 *   5. Both the allow and the deny attempt show up in the audit log
 */

const assert = require('assert');

const BASE_URL = process.env.VAULTKEY_URL || `http://localhost:${process.env.PORT || 3000}`;

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log(`Running VaultKey smoke test against ${BASE_URL}\n`);

  // 1. Log in as both seeded identities
  const adminLogin = await request('POST', '/api/auth/login', {
    name: 'admin',
    credential: 'AdminPass123!',
  });
  assert.strictEqual(adminLogin.status, 200, `admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  console.log('✓ Logged in as admin');

  const serviceLogin = await request('POST', '/api/auth/login', {
    name: 'backend-svc',
    credential: 'ServicePass123!',
  });
  assert.strictEqual(serviceLogin.status, 200, `backend-svc login failed: ${JSON.stringify(serviceLogin.data)}`);
  const serviceToken = serviceLogin.data.token;
  console.log('✓ Logged in as backend-svc');

  // 2. Create a secret (tag matches the seeded policy: service/app-config/read -> allow)
  const secretValue = `db-password-${Date.now()}`;
  const createRes = await request(
    'POST',
    '/api/secrets',
    { name: 'db-password', tag: 'app-config', value: secretValue },
    adminToken,
  );
  assert.strictEqual(createRes.status, 201, `secret creation failed: ${JSON.stringify(createRes.data)}`);
  const secretId = createRes.data.id;
  console.log(`✓ Created secret ${secretId} (tag: app-config)`);

  // 3. Allowed path: backend-svc has a policy allowing read on app-config
  const allowedRead = await request('GET', `/api/secrets/${secretId}`, null, serviceToken);
  assert.strictEqual(allowedRead.status, 200, `expected allowed read to succeed: ${JSON.stringify(allowedRead.data)}`);
  assert.strictEqual(allowedRead.data.value, secretValue, 'decrypted value did not match what was stored');
  console.log('✓ backend-svc (allowed by policy) read the secret and got the correct decrypted value');

  // 4. Denied path: admin has no read policy for app-config, so the fail-closed
  //    default applies and access is denied even though admin created the secret.
  const deniedRead = await request('GET', `/api/secrets/${secretId}`, null, adminToken);
  assert.strictEqual(deniedRead.status, 403, `expected denied read to return 403: ${JSON.stringify(deniedRead.data)}`);
  console.log('✓ admin (no matching allow policy) was denied with 403, as expected');

  // 5. Both attempts should be visible in the audit log
  const auditRes = await request('GET', '/api/audit', null, adminToken);
  assert.strictEqual(auditRes.status, 200, `audit log fetch failed: ${JSON.stringify(auditRes.data)}`);

  const entriesForSecret = auditRes.data.filter((row) => row.secret_id === secretId);
  const hasAllowed = entriesForSecret.some((row) => row.result === 'allowed' && row.action === 'read');
  const hasDenied = entriesForSecret.some((row) => row.result === 'denied' && row.action === 'read');

  assert.ok(hasAllowed, 'expected an "allowed" read entry in the audit log for this secret');
  assert.ok(hasDenied, 'expected a "denied" read entry in the audit log for this secret');
  console.log('✓ Audit log contains both the allowed and the denied read attempts');

  console.log('\nAll checks passed. Envelope encryption, RBAC, and audit logging are working end to end.');
}

main().catch((err) => {
  console.error('\n✗ Smoke test failed:', err.message);
  process.exit(1);
});
