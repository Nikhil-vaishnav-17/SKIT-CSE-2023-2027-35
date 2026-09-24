const bcrypt = require('bcrypt');
const { pool } = require('./pool');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Database Seed Script
 * 
 * Creates a default admin user so the system is usable
 * immediately after running migrations.
 * 
 * The admin can then create teachers and manage the system.
 */

const seedAdmin = async () => {
  const client = await pool.connect();

  try {
    // Check if admin already exists
    const existing = await client.query(
      "SELECT id FROM users WHERE email = $1",
      ['admin@attendai.com']
    );

    if (existing.rows.length > 0) {
      logger.info('Default admin already exists, skipping seed');
      return;
    }

    // Hash the default admin password
    const passwordHash = await bcrypt.hash('Admin@123', config.bcrypt.saltRounds);

    await client.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4)`,
      ['System Admin', 'admin@attendai.com', passwordHash, 'admin']
    );

    logger.info('Default admin user created: admin@attendai.com');
  } catch (err) {
    logger.error('Seed failed:', { message: err.message });
    throw err;
  } finally {
    client.release();
  }
};

// Run if called directly: node src/db/seed.js
if (require.main === module) {
  seedAdmin()
    .then(() => {
      logger.info('Seed complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Seed failed:', { message: err.message });
      process.exit(1);
    });
}

module.exports = { seedAdmin };
