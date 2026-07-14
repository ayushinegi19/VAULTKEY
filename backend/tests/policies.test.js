const request = require('supertest');
const app = require('../server');
const { loadTokens } = require('./helpers/tokens');

describe('Policies', () => {
  let tokens;
  let policyId;
  const testTag = `jest-tag-${Date.now()}`;

  beforeAll(() => {
    tokens = loadTokens();
  });

  afterAll(async () => {
    if (policyId) {
      await request(app)
        .delete(`/api/policies/${policyId}`)
        .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    }
  });

  test('admin can create a policy', async () => {
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`)
      .send({ role: 'user', resourceTag: testTag, action: 'read', effect: 'allow' });
    expect(res.status).toBe(201);
    policyId = res.body.id;
  });

  test('non-admin cannot create a policy', async () => {
    const res = await request(app)
      .post('/api/policies')
      .set('Authorization', `Bearer ${tokens.service.accessToken}`)
      .send({ role: 'user', resourceTag: testTag, action: 'read', effect: 'allow' });
    expect(res.status).toBe(403);
  });

  test('admin can list policies and see the new one', async () => {
    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.id === policyId)).toBe(true);
  });

  test('non-admin cannot list policies', async () => {
    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('admin can delete the policy', async () => {
    const res = await request(app)
      .delete(`/api/policies/${policyId}`)
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(204);
    policyId = null;
  });
});