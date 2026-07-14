/**
 * Express middleware factory: validates req.body against the given
 * zod schema. On success, replaces req.body with the parsed
 * (type-coerced) result. On failure, responds 400 with a flattened
 * list of field errors instead of letting bad input reach the DB.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
