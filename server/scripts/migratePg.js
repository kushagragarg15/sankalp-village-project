// Applies db/migrations/*.sql to DATABASE_URL, tracked in the
// `drizzle`.`__drizzle_migrations` table so re-runs are no-ops.
//
//   npm run db:migrate
//
require('dotenv').config();

const path = require('path');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (see server/.env.example).');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
  const db = drizzle(pool);

  console.log('Applying PostgreSQL migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'db', 'migrations') });
  console.log('Migrations applied.');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
