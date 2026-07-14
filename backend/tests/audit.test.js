const request = require('supertest');
const app = require('../server');
const { loadTokens } = require('./helpers/tokens');

describe('Audit log', () => {
  let tokens;

  beforeAll(() => {
    tokens = loadTokens();
  });

  test('admin can view the audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('filtering by result=denied returns only denied entries', async () => {
    const res = await request(app)
      .get('/api/audit?result=denied&limit=50')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.every((entry) => entry.result === 'denied')).toBe(true);
  });

  test('non-admin cannot view the audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(res.status).toBe(403);
  });
});