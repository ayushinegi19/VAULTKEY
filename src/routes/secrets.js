const express = require('express');
const {
  createSecret,
  getSecret,
  listSecrets,
  updateSecret,
  rotateSecret,
  deleteSecret,
} = require('../controllers/secretsController');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { createSecretSchema, updateSecretSchema } = require('../validation/schemas');

const router = express.Router();

router.post('/', authenticate, validate(createSecretSchema), asyncHandler(createSecret));
router.get('/', authenticate, asyncHandler(listSecrets));
router.get('/:id', authenticate, asyncHandler(getSecret));
router.patch('/:id', authenticate, validate(updateSecretSchema), asyncHandler(updateSecret));
router.post('/:id/rotate', authenticate, asyncHandler(rotateSecret));
router.delete('/:id', authenticate, asyncHandler(deleteSecret));

module.exports = router;
