const express = require('express');
const { createPolicy, listPolicies, deletePolicy } = require('../controllers/policiesController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { createPolicySchema } = require('../validation/schemas');

const router = express.Router();

router.post('/', authenticate, requireRole('admin'), validate(createPolicySchema), asyncHandler(createPolicy));
router.get('/', authenticate, requireRole('admin'), asyncHandler(listPolicies));
router.delete('/:id', authenticate, requireRole('admin'), asyncHandler(deletePolicy));

module.exports = router;
