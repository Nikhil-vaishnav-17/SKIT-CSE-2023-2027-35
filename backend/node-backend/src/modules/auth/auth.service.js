const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const config = require('../../config');
const { query } = require('../../db/pool');
const { UnauthorizedError, NotFoundError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Generate JWT Token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * Register new student and return token + user details
 */
const register = async (name, email, password) => {
  const normalizedEmail = email.toLowerCase();

  // 1. Check if email already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (existingUser.rows.length > 0) {
    const error = new Error('Email is already registered');
    error.statusCode = 409;
    throw error;
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(
    password,
    config.bcrypt.saltRounds
  );

  // 3. Create student account
  const result = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, normalizedEmail, passwordHash, 'student']
  );

  const user = result.rows[0];

  // 4. Generate JWT token
  const token = generateToken(user);

  logger.info(`New student registered: ${user.email}`);

  // 5. Return user details + token
  return {
    token,
    user,
  };
};

/**
 * Login user and return token + user details
 */
const login = async (email, password) => {
  // 1. Find user by email
  const result = await query(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // 2. Verify password
  const isValidPassword = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // 3. Generate token
  const token = generateToken(user);

  // 4. Return sanitized user data (no password hash)
  const { password_hash, ...safeUser } = user;

  logger.info(`User logged in: ${safeUser.email}`);

  return {
    token,
    user: safeUser,
  };
};

/**
 * Get user profile by ID
 */
const getProfile = async (userId) => {
  const result = await query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
};

module.exports = {
  register,
  login,
  getProfile,
};