const express = require('express');
const authController = require('./auth.controller');
const { verifyToken } = require('../../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user profile
 * @access  Private (Requires valid token)
 */
router.get('/me', verifyToken, authController.getProfile);

module.exports = router;
