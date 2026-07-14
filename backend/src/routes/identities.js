const express = require('express');
const { createIdentity, listIdentities } = require('../controllers/identitiesController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { createIdentitySchema } = require('../validation/schemas');

const router = express.Router();

router.post('/', validate(createIdentitySchema), asyncHandler(createIdentity));
router.get('/', authenticate, requireRole('admin'), asyncHandler(listIdentities));

module.exports = router;
