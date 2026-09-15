const { eq } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users } = require('../db/schema');
require('dotenv').config({ path: './.env' });

const updateAllUserRoles = async () => {
  try {
    await connectPG();
    console.log('Connected to PostgreSQL');
    const db = getDb();

    const rows = await db.select().from(users);
    console.log(`Found ${rows.length} users\n`);

    let updatedCount = 0;

    for (const user of rows) {
      const email = user.email;
      let newRole = user.role;

      // Determine role based on email pattern
      if (email.startsWith('23') || email.startsWith('24')) {
        newRole = 'admin';
      } else if (email.startsWith('25') || email.startsWith('26')) {
        newRole = 'volunteer';
      }

      if (newRole !== user.role) {
        console.log(`Updating: ${user.name} (${email})`);
        console.log(`  ${user.role} → ${newRole}`);

        await db.update(users).set({ role: newRole }).where(eq(users.id, user.id));
        updatedCount++;
      }
    }

    console.log(`\n✅ Updated ${updatedCount} user(s)`);
    console.log('Users with updated roles should log out and log back in to see changes.');

    process.exit(0);
  } catch (error) {
    console.error('Error updating user roles:', error);
    process.exit(1);
  }
};

updateAllUserRoles();
