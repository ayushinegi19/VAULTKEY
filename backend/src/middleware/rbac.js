const pool = require('../config/db');

/**
 * Core policy decision function. Given a role, a resource tag, and
 * an action, decides 'allow' or 'deny'.
 *
 * Precedence rules (fail closed by design):
 *   - If ANY matching policy row has effect='deny', the result is 'deny'.
 *   - Else if ANY matching policy row has effect='allow', the result is 'allow'.
 *   - Else (no matching policy row at all), the result is 'deny'.
 *
 * This means an explicit deny always wins over an allow, and the
 * absence of a policy is treated as "not permitted" rather than
 * "permitted" — the safer default for a secrets system.
 */
async function checkPolicy(role, resourceTag, action) {
  const { rows } = await pool.query(
    `SELECT effect FROM policies WHERE role = $1 AND resource_tag = $2 AND action = $3`,
    [role, resourceTag, action],
  );

  if (rows.length === 0) {
    return 'deny';
  }
  if (rows.some((row) => row.effect === 'deny')) {
    return 'deny';
  }
  if (rows.some((row) => row.effect === 'allow')) {
    return 'allow';
  }
  return 'deny';
}

/**
 * Express middleware factory for routes that are gated purely by
 * role (e.g. admin-only endpoints like /api/policies, /api/audit).
 * For resource-tag-based checks (e.g. reading a specific secret),
 * use checkPolicy directly inside the controller instead, since the
 * resource tag is only known after loading the target row.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.identity || !allowedRoles.includes(req.identity.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { checkPolicy, requireRole };
