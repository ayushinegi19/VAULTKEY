const request = require('supertest');
const app = require('../server');

describe('Auth', () => {
  test('login with valid credentials returns an access + refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: 'admin', credential: 'AdminPass123!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.role).toBe('admin');
  });

  test('login with wrong credentials is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: 'admin', credential: 'totally-wrong' });
    expect(res.status).toBe(401);
  });

  test('refresh token rotates: the old token becomes unusable after one use', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ name: 'backend-svc', credential: 'ServicePass123!' });
    expect(login.status).toBe(200);
    const oldRefresh = login.body.refreshToken;

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body).toHaveProperty('accessToken');

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reuse.status).toBe(401);

    await request(app).post('/api/auth/logout').send({ refreshToken: refreshed.body.refreshToken });
  });
});