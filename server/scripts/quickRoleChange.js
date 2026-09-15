require('dotenv').config();
const { eq } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users } = require('../db/schema');

// Usage: node quickRoleChange.js <email> <role>
// Example: node quickRoleChange.js test@example.com volunteer

const quickRoleChange = async () => {
  try {
    const email = process.argv[2];
    const role = process.argv[3];

    if (!email || !role) {
      console.log('\n❌ Usage: node quickRoleChange.js <email> <role>');
      console.log('\nExamples:');
      console.log('  node quickRoleChange.js test@example.com admin');
      console.log('  node quickRoleChange.js user@gmail.com volunteer\n');
      process.exit(1);
    }

    if (role !== 'admin' && role !== 'volunteer') {
      console.log('❌ Role must be either "admin" or "volunteer"');
      process.exit(1);
    }

    await connectPG();
    console.log('✅ Connected to PostgreSQL');
    const db = getDb();

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      console.log(`\n❌ User with email "${email}" not found.\n`);
      process.exit(1);
    }

    const oldRole = user.role;
    await db.update(users).set({ role }).where(eq(users.id, user.id));

    console.log(`\n✅ Successfully updated ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${oldRole} → ${role}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

quickRoleChange();
