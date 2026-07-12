const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer JWT on the Authorization header and attaches
 * the decoded identity ({ id, role }) to req.identity for
 * downstream handlers/middleware to use.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.identity = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
