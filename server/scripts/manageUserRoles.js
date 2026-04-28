require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const listUsers = async () => {
  const users = await User.find().select('name email role').sort({ email: 1 });
  
  console.log('\n=== Current Users ===\n');
  users.forEach((user, index) => {
    const roleDisplay = user.role === 'admin' ? '👑 ADMIN' : '👤 VOLUNTEER';
    console.log(`${index + 1}. ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${roleDisplay}`);
    console.log('');
  });
  
  return users;
};

const changeUserRole = async (email, newRole) => {
  const user = await User.findOne({ email });
  
  if (!user) {
    console.log(`❌ User with email ${email} not found.`);
    return false;
  }
  
  const oldRole = user.role;
  user.role = newRole;
  await user.save();
  
  console.log(`\n✅ Successfully updated ${user.name}`);
  console.log(`   ${oldRole} → ${newRole}`);
  return true;
};

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

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
          await listUsers();
          await question('\nPress Enter to continue...');
          break;

        case '2':
          await listUsers();
          const email = await question('\nEnter user email: ');
          console.log('\nAvailable roles:');
          console.log('  - admin');
          console.log('  - volunteer');
          const role = await question('\nEnter new role: ');
          
          if (role !== 'admin' && role !== 'volunteer') {
            console.log('❌ Invalid role. Must be "admin" or "volunteer"');
          } else {
            await changeUserRole(email.trim(), role.trim());
          }
          await question('\nPress Enter to continue...');
          break;

        case '3':
          await listUsers();
          const adminEmail = await question('\nEnter user email to make admin: ');
          await changeUserRole(adminEmail.trim(), 'admin');
          await question('\nPress Enter to continue...');
          break;

        case '4':
          await listUsers();
          const volunteerEmail = await question('\nEnter user email to make volunteer: ');
          await changeUserRole(volunteerEmail.trim(), 'volunteer');
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
