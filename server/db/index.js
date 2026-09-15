const { drizzle } = require('drizzle-orm/node-postgres');
const { getPool } = require('./pool');
const schema = require('./schema');

let db = null;

// Lazy: the pool (and its DATABASE_URL requirement) is only created once
// something actually queries the database, same as Mongoose's connectDB
// being called explicitly from server.js rather than at require time.
const getDb = () => {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
};

module.exports = { getDb, schema };
