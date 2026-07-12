const pool = require('../config/db');

const VALID_EFFECTS = ['allow', 'deny'];

async function createPolicy(req, res) {
  const { role, resourceTag, action, effect } = req.body;

  if (!role || !resourceTag || !action || !effect) {
    return res.status(400).json({ error: 'role, resourceTag, action, and effect are required' });
  }
  if (!VALID_EFFECTS.includes(effect)) {
    return res.status(400).json({ error: `effect must be one of: ${VALID_EFFECTS.join(', ')}` });
  }

  const { rows } = await pool.query(
    `INSERT INTO policies (role, resource_tag, action, effect)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, resource_tag, action, effect, created_at`,
    [role, resourceTag, action, effect],
  );

  res.status(201).json(rows[0]);
}

module.exports = { createPolicy };
