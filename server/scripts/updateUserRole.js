const { eq } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users } = require('../db/schema');
require('dotenv').config({ path: './.env' });

const updateUserRole = async () => {
  try {
    await connectPG();
    console.log('Connected to PostgreSQL');
    const db = getDb();

    const email = '23ucc564@lnmiit.ac.in';

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Current role: ${user.role}`);

    await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));

    console.log('✅ Updated role to: admin');
    console.log('\nPlease log out and log back in to see the changes.');

    process.exit(0);
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  }
};

updateUserRole();
