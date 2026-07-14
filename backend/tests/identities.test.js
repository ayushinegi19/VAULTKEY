const request = require('supertest');
const app = require('../server');
const { loadTokens } = require('./helpers/tokens');

describe('Identities', () => {
  let tokens;
  const uniqueName = `jest-user-${Date.now()}`;

  beforeAll(() => {
    tokens = loadTokens();
  });

  test('weak password is rejected by validation', async () => {
    const res = await request(app)
      .post('/api/identities')
      .send({ name: `${uniqueName}-weak`, credential: 'short', role: 'user' });
    expect(res.status).toBe(400);
  });

  test('strong password creates a new identity', async () => {
    const res = await request(app)
      .post('/api/identities')
      .send({ name: uniqueName, credential: 'Str0ng!JestPass9', role: 'user' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(uniqueName);
  });

  test('admin can list identities without exposing hashed credentials', async () => {
    const res = await request(app)
      .get('/api/identities')
      .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((i) => i.name === uniqueName)).toBe(true);
    expect(res.body[0]).not.toHaveProperty('hashed_credential');
  });

  test('non-admin cannot list identities', async () => {
    const res = await request(app)
      .get('/api/identities')
      .set('Authorization', `Bearer ${tokens.service.accessToken}`);
    expect(res.status).toBe(403);
  });
});