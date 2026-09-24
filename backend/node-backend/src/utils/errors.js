/**
 * Custom Application Error Classes
 * 
 * These extend the native Error class so the global error handler
 * can distinguish between different error types and return
 * appropriate HTTP status codes.
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // Distinguishes expected errors from programming bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service unavailable') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ExternalServiceError,
};
