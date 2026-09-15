require('dotenv').config();
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users } = require('../db/schema');

const listUsers = async () => {
  try {
    await connectPG();
    const db = getDb();

    const rows = await db.select({ name: users.name, email: users.email, role: users.role, googleId: users.googleId }).from(users);

    console.log('\n=== Current Users in Database ===\n');

    if (rows.length === 0) {
      console.log('No users found in database.');
    } else {
      rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Google ID: ${user.googleId ? 'Yes' : 'No'}`);
        console.log('');
      });

      console.log(`Total users: ${rows.length}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

listUsers();
