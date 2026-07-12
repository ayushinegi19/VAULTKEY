const express = require('express');
const { listAuditLog } = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', authenticate, requireRole('admin'), asyncHandler(listAuditLog));

module.exports = router;
