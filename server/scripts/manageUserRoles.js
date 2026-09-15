require('dotenv').config();
const { eq, asc } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users } = require('../db/schema');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const listUsers = async (db) => {
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(asc(users.email));

  console.log('\n=== Current Users ===\n');
  rows.forEach((user, index) => {
    const roleDisplay = user.role === 'admin' ? '👑 ADMIN' : '👤 VOLUNTEER';
    console.log(`${index + 1}. ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${roleDisplay}`);
    console.log('');
  });

  return rows;
};

const changeUserRole = async (db, email, newRole) => {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    console.log(`❌ User with email ${email} not found.`);
    return false;
  }

  const oldRole = user.role;
  await db.update(users).set({ role: newRole }).where(eq(users.id, user.id));

  console.log(`\n✅ Successfully updated ${user.name}`);
  console.log(`   ${oldRole} → ${newRole}`);
  return true;
};

const main = async () => {
  try {
    await connectPG();
    console.log('✅ Connected to PostgreSQL\n');
    const db = getDb();

    while (true) {
      console.log('\n╔════════════════════════════════════╗');
      console.log('║   USER ROLE MANAGEMENT TOOL        ║');
      console.log('╚════════════════════════════════════╝\n');
      console.log('1. List all users');
      console.log('2. Change user role by email');
      console.log('3. Make user admin');
      console.log('4. Make user volunteer');
      console.log('5. Exit\n');

      const choice = await question('Select an option (1-5): ');

      switch (choice.trim()) {
        case '1':
          await listUsers(db);
          await question('\nPress Enter to continue...');
          break;

        case '2':
          await listUsers(db);
          const email = await question('\nEnter user email: ');
          console.log('\nAvailable roles:');
          console.log('  - admin');
          console.log('  - volunteer');
          const role = await question('\nEnter new role: ');
          
          if (role !== 'admin' && role !== 'volunteer') {
            console.log('❌ Invalid role. Must be "admin" or "volunteer"');
          } else {
            await changeUserRole(db, email.trim(), role.trim());
          }
          await question('\nPress Enter to continue...');
          break;

        case '3':
          await listUsers(db);
          const adminEmail = await question('\nEnter user email to make admin: ');
          await changeUserRole(db, adminEmail.trim(), 'admin');
          await question('\nPress Enter to continue...');
          break;

        case '4':
          await listUsers(db);
          const volunteerEmail = await question('\nEnter user email to make volunteer: ');
          await changeUserRole(db, volunteerEmail.trim(), 'volunteer');
          await question('\nPress Enter to continue...');
          break;

        case '5':
          console.log('\n👋 Goodbye!\n');
          rl.close();
          process.exit(0);

        default:
          console.log('❌ Invalid option. Please select 1-5.');
          await question('\nPress Enter to continue...');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
};

main();
