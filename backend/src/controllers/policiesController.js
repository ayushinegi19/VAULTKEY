const pool = require('../config/db');

// Shape/effect validation now lives in src/validation/schemas.js
// (createPolicySchema) and runs via the validate() middleware.
async function createPolicy(req, res) {
  const { role, resourceTag, action, effect } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO policies (role, resource_tag, action, effect)
     VALUES ($1, $2, $3, $4)
     RETURNING id, role, resource_tag, action, effect, created_at`,
    [role, resourceTag, action, effect],
  );

  res.status(201).json(rows[0]);
}

async function listPolicies(req, res) {
  const { rows } = await pool.query(
    `SELECT id, role, resource_tag, action, effect, created_at
     FROM policies ORDER BY created_at DESC`,
  );
  res.json(rows);
}

async function deletePolicy(req, res) {
  const { id } = req.params;
  const { rowCount } = await pool.query(`DELETE FROM policies WHERE id = $1`, [id]);
  if (rowCount === 0) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  res.status(204).send();
}

module.exports = { createPolicy, listPolicies, deletePolicy };
