const logger = require('../utils/logger');
const { sendError } = require('../utils/response');
const { AppError } = require('../utils/errors');

/**
 * Global Error Handler Middleware
 * 
 * This is the last middleware in the Express pipeline.
 * It catches all errors thrown or passed via next(err) and
 * returns a standardized error response.
 * 
 * - Operational errors (AppError): Return the specific status/message
 * - Programming errors: Return generic 500 without exposing internals
 */
const errorHandler = (err, req, res, _next) => {
  // Log the error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(`${err.errorCode}: ${err.message}`, {
      method: req.method,
      path: req.originalUrl,
      statusCode: err.statusCode,
    });
  } else {
    // Unexpected error — log the full stack
    logger.error('Unexpected error:', {
      message: err.message,
      stack: err.stack,
      method: req.method,
      path: req.originalUrl,
    });
  }

  // If it's a known operational error, use its status and message
  if (err instanceof AppError) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      error: err.errorCode,
    });
  }

  // Joi validation error (from validation middleware)
  if (err.isJoi) {
    return sendError(res, {
      statusCode: 422,
      message: err.details?.[0]?.message || 'Validation failed',
      error: 'VALIDATION_ERROR',
    });
  }

  // Unknown error — do not expose internals
  return sendError(res, {
    statusCode: 500,
    message: 'Something went wrong. Please try again later.',
    error: 'INTERNAL_ERROR',
  });
};

module.exports = errorHandler;
