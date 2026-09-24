const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'attendai',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // AI Service
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.AI_SERVICE_TIMEOUT, 10) || 30000,
  },

  // Bcrypt
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
};

// Validate critical config at startup
const requiredVars = ['jwt.secret'];
for (const varPath of requiredVars) {
  const keys = varPath.split('.');
  let value = config;
  for (const key of keys) {
    value = value?.[key];
  }
  if (!value) {
    throw new Error(`Missing required environment variable for: ${varPath}. Check your .env file.`);
  }
}

module.exports = config;
