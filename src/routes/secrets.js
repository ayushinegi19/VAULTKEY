const express = require('express');
const { createSecret, getSecret } = require('../controllers/secretsController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/', authenticate, asyncHandler(createSecret));
router.get('/:id', authenticate, asyncHandler(getSecret));

module.exports = router;
