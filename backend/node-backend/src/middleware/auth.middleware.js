const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header (Bearer <token>)
 * Attaches decoded user info to req.user
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authentication failed: Missing or invalid Authorization header');
    return next(new UnauthorizedError('Please authenticate first'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Attach user payload to request
    // Decoded payload contains { id, role } as defined in authService.generateToken
    req.user = decoded; 
    
    next();
  } catch (err) {
    logger.warn(`Authentication failed: ${err.message}`);
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Middleware to restrict access based on user role.
 * Must be used AFTER verifyToken middleware.
 * 
 * @param {...string} allowedRoles - List of allowed roles (e.g., 'admin', 'teacher')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Authorization failed: User ${req.user.id} with role ${req.user.role} attempted to access restricted route requiring ${allowedRoles.join(' or ')}`);
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireRole,
};
