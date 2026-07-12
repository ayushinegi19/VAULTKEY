const express = require('express');
const { login, refresh, logout } = require('../controllers/authController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { loginSchema, refreshSchema } = require('../validation/schemas');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refresh));
router.post('/logout', validate(refreshSchema), asyncHandler(logout));

module.exports = router;
