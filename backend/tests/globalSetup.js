require('dotenv').config();
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

module.exports = async () => {
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ name: 'admin', credential: 'AdminPass123!' });

  const serviceLogin = await request(app)
    .post('/api/auth/login')
    .send({ name: 'backend-svc', credential: 'ServicePass123!' });

  if (adminLogin.status !== 200 || serviceLogin.status !== 200) {
    throw new Error(
      'Global setup could not log in the seeded identities. Confirm schema+seed+migration are applied and .env is correct.',
    );
  }

  const tokens = {
    admin: { accessToken: adminLogin.body.accessToken, refreshToken: adminLogin.body.refreshToken },
    service: { accessToken: serviceLogin.body.accessToken, refreshToken: serviceLogin.body.refreshToken },
  };

  fs.writeFileSync(path.join(__dirname, '.tmp-tokens.json'), JSON.stringify(tokens));
};