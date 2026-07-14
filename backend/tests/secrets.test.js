const request = require('supertest');
const app = require('../server');
const { loadTokens } = require('./helpers/tokens');

describe('Secrets', () => {
  let tokens;
  let secretId;

  beforeAll(() => {
    tokens = loadTokens();
  });

  afterAll(async () => {
    if (secretId) {
      await request(app)
        .delete(`/api/secrets/${secretId}`)
        .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    }
  });

  test('create a secret (envelope-encrypted)', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`)
      .send({ name: 'jest-secret', tag: 'app-config', value: 'jest-value-123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    secretId = res.body.id;
  });

  test('allowed role (backend-svc) can read and decrypt it', async () => {
    const res = await request(app)
      .get(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.value).toBe('jest-value-123');
  });

  test('denied role (admin has no read policy on app-config) is rejected', async () => {
    const res = await request(app)
      .get(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('listing returns metadata only, never the decrypted value', async () => {
    const res = await request(app)
      .get('/api/secrets')
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(res.status).toBe(200);
    const found = res.body.find((s) => s.id === secretId);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty('value');
    expect(found).not.toHaveProperty('encrypted_value');
  });

  test('rotate re-encrypts under a new data key without changing plaintext', async () => {
    const rotate = await request(app)
      .post(`/api/secrets/${secretId}/rotate`)
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(rotate.status).toBe(200);

    const read = await request(app)
      .get(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(read.body.value).toBe('jest-value-123');
  });

  test('update changes the plaintext value', async () => {
    const update = await request(app)
      .patch(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`)
      .send({ value: 'jest-value-updated' });
    expect(update.status).toBe(200);

    const read = await request(app)
      .get(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(read.body.value).toBe('jest-value-updated');
  });

  test('soft delete hides the secret from further reads', async () => {
    const del = await request(app)
      .delete(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(del.status).toBe(204);

    const read = await request(app)
      .get(`/api/secrets/${secretId}`)
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(read.status).toBe(404);

    secretId = null;
  });
});