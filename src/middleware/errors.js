const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the invalid fields.',
        details: result.array().map(({ path, msg }) => ({ field: path, message: msg }))
      }
    });
  }
  next();
}

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let code = error.code || 'INTERNAL_ERROR';
  let message = status >= 500 ? 'An unexpected server error occurred.' : error.message;
  let details;

  if (error.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Please correct the invalid fields.';
    details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message
    }));
  } else if (error.name === 'CastError') {
    status = 400;
    code = 'INVALID_IDENTIFIER';
    message = 'The supplied identifier is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'A record with that value already exists.';
  }

  if (status >= 500) console.error(error);
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

module.exports = { validateRequest, notFound, errorHandler };
