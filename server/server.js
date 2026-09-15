const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const { connectPG } = require('./db/pool');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// PostgreSQL is the primary database — every route below reads and writes it.
connectPG();
// MongoDB is kept connected (not removed) until the PostgreSQL migration is
// verified in production; nothing in the app queries it anymore except the
// one-off scripts/migrateToPg.js.
connectDB();

const app = express();

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

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
