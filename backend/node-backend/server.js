const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { testConnection } = require('./src/db/pool');

/**
 * Server Entry Point
 * 
 * 1. Tests database connection
 * 2. Starts the Express server
 * 3. Handles graceful shutdown
 */

const startServer = async () => {
  // Test database connectivity before starting
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Server will not start.');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info(`AttendAI backend running on port ${config.port} [${config.nodeEnv}]`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled rejections and uncaught exceptions
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', { reason: reason?.message || reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', { message: err.message, stack: err.stack });
    process.exit(1);
  });
};

startServer();
