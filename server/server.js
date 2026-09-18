const dotenv = require('dotenv');

// Load env vars before anything reads process.env.
dotenv.config();

const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { connectPG } = require('./db/pool');
const createApp = require('./app');

// PostgreSQL is the primary database — every route reads and writes it.
connectPG();
// MongoDB is kept connected (not removed) until the PostgreSQL migration is
// verified in production; nothing in the app queries it anymore except the
// one-off scripts/migrateToPg.js. Optional: a deployment without MONGO_URI
// (e.g. docker-compose) simply skips it.
if (process.env.MONGO_URI) connectDB();
else logger.info('MONGO_URI not set — skipping legacy MongoDB connection');

const app = createApp();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled promise rejection');
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Let the platform (Render, Docker) stop us cleanly: finish in-flight
// requests, then exit, instead of dropping connections on SIGTERM.
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});
