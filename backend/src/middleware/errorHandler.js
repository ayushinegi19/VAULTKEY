/**
 * Centralized error handler. Any controller that calls next(err)
 * (or throws inside an async handler wrapped by asyncHandler) ends
 * up here. Keeps error shape consistent and avoids leaking stack
 * traces to clients.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const logger = require('../config/logger');
// ...inside errorHandler, replace console.error(err) with:
logger.error(err);

  if (err.code === '23505') {
    // Postgres unique_violation
    return res.status(409).json({ error: 'Resource already exists' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}

/**
 * Small helper to avoid try/catch boilerplate in every async
 * controller — wraps a handler and forwards any rejected promise
 * to next(), which routes it into errorHandler above.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
