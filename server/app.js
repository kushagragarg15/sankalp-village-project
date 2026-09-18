const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { httpMetrics, metricsHandler } = require('./middleware/metrics');

// Builds the Express app without opening any connection or listening on a
// port. server.js does that for production; the test suite mounts this
// directly under Supertest with the database mocked.
const createApp = () => {
  const app = express();

  // Request id + structured access log, first so every later middleware
  // (and the error handler) can use req.log / req.id.
  app.use(requestLogger);
  app.use(httpMetrics);

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Cookie parser
  app.use(cookieParser());

  // Enable CORS
  // Every request carries an Authorization header, which makes it a "non-simple"
  // cross-origin request: without a Max-Age the browser re-sends an OPTIONS
  // preflight every few seconds, doubling the round trips for the whole API.
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    maxAge: 86400
  }));

  // Unauthenticated, no DB touch — for an uptime monitor to ping and keep the
  // Render free-tier instance from sleeping after 15 minutes idle.
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  // Prometheus scrape endpoint. Unauthenticated like /health; if the API is
  // ever public-facing, put it behind the scraper's network or a bearer token.
  app.get('/metrics', metricsHandler);

  // Mount routers
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/students', require('./routes/students'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/prep', require('./routes/prep'));

  // Attendance system routes
  app.use('/api/attendance-sessions', require('./routes/attendanceSessions'));
  app.use('/api/registrations', require('./routes/registrations'));
  app.use('/api/teaching-logs', require('./routes/teachingLogs'));
  app.use('/api/volunteer-attendance', require('./routes/volunteerAttendance'));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
