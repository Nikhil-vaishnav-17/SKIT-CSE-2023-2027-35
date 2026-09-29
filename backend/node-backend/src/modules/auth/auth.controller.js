const Joi = require('joi');
const authService = require('./auth.service');
const { sendSuccess } = require('../../utils/response');
const { ValidationError } = require('../../utils/errors');

// Input validation schema for login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * Handle user login
 */
const login = async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    // Call service layer
    const result = await authService.login(value.email, value.password);

    // Return success response
    return sendSuccess(res, {
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    next(err); // Pass error to global error handler
  }
};

/**
 * Get current logged in user's profile
 */
const getProfile = async (req, res, next) => {
  try {
    // req.user is set by the auth middleware
    const user = await authService.getProfile(req.user.id);

    return sendSuccess(res, {
      message: 'Profile fetched successfully',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getProfile,
};
