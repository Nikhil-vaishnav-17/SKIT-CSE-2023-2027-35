const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const logger = require('../utils/logger');

/**
 * Database Migration Runner
 * 
 * Reads SQL files from the migrations/ directory and 
 * executes them in alphabetical order.
 * 
 * Tracks which migrations have been applied using a 
 * `migrations` table so they are never run twice.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query('SELECT filename FROM migrations ORDER BY id');
  return result.rows.map((row) => row.filename);
};

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.includes(f));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      await client.query('COMMIT');
      return;
    }

    for (const file of pending) {
      logger.info(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      await client.query(sql);
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [file]
      );
      logger.info(`Migration applied: ${file}`);
    }

    await client.query('COMMIT');
    logger.info(`${pending.length} migration(s) applied successfully`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', { message: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
};

// Run if called directly: node src/db/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', { message: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
