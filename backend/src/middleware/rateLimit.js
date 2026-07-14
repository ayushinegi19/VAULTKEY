const rateLimit = require('express-rate-limit');

// Applied to every request: generous enough not to bother normal
// usage, tight enough to blunt scripted abuse.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Applied only to /api/auth/login: much stricter, since login is
// the endpoint brute-force / credential-stuffing attacks target.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

module.exports = { globalLimiter, loginLimiter };
