const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * PostgreSQL Connection Pool
 * 
 * Uses a connection pool instead of individual connections for:
 * - Better performance (reuses connections)
 * - Automatic connection management
 * - Concurrency support
 */
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,                // Max connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if connection takes > 5s
});

// Log pool connection events
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error:', { message: err.message });
});

/**
 * Execute a SQL query using the connection pool.
 * 
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters (for parameterized queries)
 * @returns {Promise<object>} - Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', {
      query: text.substring(0, 100), // Log only first 100 chars
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    return result;
  } catch (err) {
    logger.error('Query failed', {
      query: text.substring(0, 100),
      error: err.message,
    });
    throw err;
  }
};

/**
 * Execute multiple queries in a transaction.
 * Automatically commits on success or rolls back on error.
 * 
 * @param {Function} callback - Receives a client; run queries with it
 * @returns {Promise<any>} - Result from the callback
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Test database connectivity.
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() AS current_time');
    logger.info(`Database connected successfully at ${result.rows[0].current_time}`);
    return true;
  } catch (err) {
    logger.error('Database connection failed:', { message: err.message });
    return false;
  }
};

module.exports = { pool, query, transaction, testConnection };
