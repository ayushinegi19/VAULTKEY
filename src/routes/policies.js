const express = require('express');
const { createPolicy } = require('../controllers/policiesController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/', authenticate, requireRole('admin'), asyncHandler(createPolicy));

module.exports = router;
