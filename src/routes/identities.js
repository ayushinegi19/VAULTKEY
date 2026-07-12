const express = require('express');
const { createIdentity } = require('../controllers/identitiesController');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/', asyncHandler(createIdentity));

module.exports = router;
