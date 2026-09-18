const { Pool } = require('pg');
const logger = require('../utils/logger');

// Mirrors config/db.js's reasoning for Mongo: fail fast instead of hanging,
// keep a warm pool so requests skip the TCP/TLS handshake.
let pool = null;

const getPool = () => {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    min: 2,
    connectionTimeoutMillis: 8000,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
  pool.on('error', (err) => {
    // Idle client errors (e.g. the pooled connection was dropped by the
    // server) must not crash the process — log and let the pool recover.
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });
  return pool;
};

const connectPG = async () => {
  try {
    const client = await getPool().connect();
    const { rows } = await client.query('SELECT current_database() AS db, version() AS version');
    client.release();
    logger.info({ database: rows[0].db }, 'PostgreSQL connected');
  } catch (error) {
    logger.fatal({ err: error }, 'PostgreSQL connection failed');
    process.exit(1);
  }
};

module.exports = { getPool, connectPG };
