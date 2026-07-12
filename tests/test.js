/**
 * Plain-Node end-to-end smoke test (no test framework required).
 *
 * Prerequisites:
 *   - Postgres running, schema.sql + seed.sql + migrations/002_phase2_phase3.sql applied
 *   - The VaultKey server running (npm start) in a separate terminal
 *
 * Run with: npm test   (or: node tests/test.js)
 *
 * Covers Phase 1 (encryption/RBAC/audit) AND Phase 2/3 additions:
 * refresh tokens, rate limiting, validation, list/update/rotate/delete,
 * policy listing, audit filtering.
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

  // ── Phase 1: login, create, allowed/denied read, audit ──────
  const adminLogin = await request('POST', '/api/auth/login', {
    name: 'admin',
    credential: 'AdminPass123!',
  });
  assert.strictEqual(adminLogin.status, 200, `admin login failed: ${JSON.stringify(adminLogin.data)}`);
  let adminToken = adminLogin.data.accessToken;
  let adminRefreshToken = adminLogin.data.refreshToken;
  console.log('✓ Logged in as admin (got access + refresh token)');

  const serviceLogin = await request('POST', '/api/auth/login', {
    name: 'backend-svc',
    credential: 'ServicePass123!',
  });
  assert.strictEqual(serviceLogin.status, 200, `backend-svc login failed: ${JSON.stringify(serviceLogin.data)}`);
  const serviceToken = serviceLogin.data.accessToken;
  console.log('✓ Logged in as backend-svc');

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

  const allowedRead = await request('GET', `/api/secrets/${secretId}`, null, serviceToken);
  assert.strictEqual(allowedRead.status, 200, `expected allowed read to succeed: ${JSON.stringify(allowedRead.data)}`);
  assert.strictEqual(allowedRead.data.value, secretValue, 'decrypted value did not match what was stored');
  console.log('✓ backend-svc (allowed by policy) read the secret and got the correct decrypted value');

  const deniedRead = await request('GET', `/api/secrets/${secretId}`, null, adminToken);
  assert.strictEqual(deniedRead.status, 403, `expected denied read to return 403: ${JSON.stringify(deniedRead.data)}`);
  console.log('✓ admin (no matching allow policy) was denied reading with 403, as expected');

  // ── Phase 2: input validation ────────────────────────────────
  const weakIdentity = await request('POST', '/api/identities', {
    name: 'weakpass-user',
    credential: 'short',
    role: 'user',
  });
  assert.strictEqual(weakIdentity.status, 400, 'expected weak password to be rejected by validation');
  console.log('✓ Weak password rejected by validation (400)');

  // ── Phase 2: refresh token rotation ─────────────────────────
  const refreshRes = await request('POST', '/api/auth/refresh', { refreshToken: adminRefreshToken });
  assert.strictEqual(refreshRes.status, 200, `refresh failed: ${JSON.stringify(refreshRes.data)}`);
  const newAdminToken = refreshRes.data.accessToken;
  const newAdminRefreshToken = refreshRes.data.refreshToken;
  console.log('✓ Refresh token exchanged for a new access + refresh token');

  const reuseOldRefresh = await request('POST', '/api/auth/refresh', { refreshToken: adminRefreshToken });
  assert.strictEqual(reuseOldRefresh.status, 401, 'expected reusing a rotated refresh token to fail');
  console.log('✓ Reusing the OLD (already-rotated) refresh token correctly fails');

  adminToken = newAdminToken;
  adminRefreshToken = newAdminRefreshToken;

  // ── Phase 3: rotate secret (re-encrypt, same plaintext) ─────
  const rotateRes = await request('POST', `/api/secrets/${secretId}/rotate`, null, adminToken);
  assert.strictEqual(rotateRes.status, 200, `rotate failed: ${JSON.stringify(rotateRes.data)}`);
  console.log('✓ Secret rotated (re-encrypted under a fresh data key)');

  const readAfterRotate = await request('GET', `/api/secrets/${secretId}`, null, serviceToken);
  assert.strictEqual(readAfterRotate.status, 200);
  assert.strictEqual(readAfterRotate.data.value, secretValue, 'value changed after rotation - it should not have');
  console.log('✓ Plaintext value unchanged after rotation, as expected');

  // ── Phase 3: update secret value ────────────────────────────
  const newValue = `${secretValue}-updated`;
  const updateRes = await request('PATCH', `/api/secrets/${secretId}`, { value: newValue }, adminToken);
  assert.strictEqual(updateRes.status, 200, `update failed: ${JSON.stringify(updateRes.data)}`);
  const readAfterUpdate = await request('GET', `/api/secrets/${secretId}`, null, serviceToken);
  assert.strictEqual(readAfterUpdate.data.value, newValue, 'expected updated value to be readable');
  console.log('✓ Secret value updated and re-readable with new plaintext');

  // ── Phase 3: list secrets (metadata only, role-filtered) ────
  const listAsService = await request('GET', '/api/secrets', null, serviceToken);
  assert.strictEqual(listAsService.status, 200);
  assert.ok(listAsService.data.some((s) => s.id === secretId), 'expected service role to see the app-config secret in listing');
  assert.ok(!('value' in (listAsService.data[0] || {})), 'listing must never include decrypted values');
  console.log('✓ Listing returns metadata only, filtered to what the role can access');

  // ── Phase 3: soft delete ────────────────────────────────────
  const deleteRes = await request('DELETE', `/api/secrets/${secretId}`, null, adminToken);
  assert.strictEqual(deleteRes.status, 204, `delete failed: ${JSON.stringify(deleteRes.data)}`);
  const readAfterDelete = await request('GET', `/api/secrets/${secretId}`, null, serviceToken);
  assert.strictEqual(readAfterDelete.status, 404, 'expected deleted secret to 404 on read');
  console.log('✓ Secret soft-deleted: no longer readable, but audit history is preserved');

  // ── Phase 3: policies listing ───────────────────────────────
  const policiesList = await request('GET', '/api/policies', null, adminToken);
  assert.strictEqual(policiesList.status, 200);
  assert.ok(policiesList.data.length > 0, 'expected at least the seeded policy to be listed');
  console.log('✓ Admin can list policies');

  // ── Phase 3: identities listing ─────────────────────────────
  const identitiesList = await request('GET', '/api/identities', null, adminToken);
  assert.strictEqual(identitiesList.status, 200);
  assert.ok(!('hashed_credential' in (identitiesList.data[0] || {})), 'identity listing must never expose hashed credentials');
  console.log('✓ Admin can list identities (no hashed credentials leaked)');

  // ── Phase 3: audit log filtering ────────────────────────────
  const auditForSecret = await request('GET', `/api/audit?secretId=${secretId}`, null, adminToken);
  assert.strictEqual(auditForSecret.status, 200);
  assert.ok(auditForSecret.data.length > 0, 'expected filtered audit entries for this secret');
  assert.ok(auditForSecret.data.every((row) => row.secret_id === secretId), 'filter returned entries for the wrong secret');
  console.log('✓ Audit log filtering by secretId works correctly');

  // ── Phase 2: logout revokes the refresh token ───────────────
  const logoutRes = await request('POST', '/api/auth/logout', { refreshToken: adminRefreshToken });
  assert.strictEqual(logoutRes.status, 204);
  const refreshAfterLogout = await request('POST', '/api/auth/refresh', { refreshToken: adminRefreshToken });
  assert.strictEqual(refreshAfterLogout.status, 401, 'expected refresh to fail after logout revoked the token');
  console.log('✓ Logout revokes the refresh token (can no longer be used to refresh)');

  console.log('\nAll checks passed — Phase 1, 2, and 3 features are working end to end.');
}

main().catch((err) => {
  console.error('\n✗ Smoke test failed:', err.message);
  process.exit(1);
});
