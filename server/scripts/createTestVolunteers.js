require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const testVolunteers = [
  {
    name: 'Test Volunteer 1',
    email: 'volunteer1@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543210'
  },
  {
    name: 'Test Volunteer 2',
    email: 'volunteer2@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543211'
  },
  {
    name: 'Test Volunteer 3',
    email: 'volunteer3@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543212'
  },
  {
    name: 'John Doe',
    email: 'john.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543213'
  },
  {
    name: 'Jane Smith',
    email: 'jane.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543214'
  }
];

const createTestVolunteers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('Creating test volunteer accounts...\n');

    let created = 0;
    let skipped = 0;

    for (const volunteerData of testVolunteers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: volunteerData.email });

      if (existingUser) {
        console.log(`⏭️  Skipped: ${volunteerData.email} (already exists)`);
        skipped++;
        continue;
      }

      // Create new user
      const user = await User.create(volunteerData);
      console.log(`✅ Created: ${user.name} (${user.email})`);
      created++;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created} accounts`);
    console.log(`   Skipped: ${skipped} accounts (already existed)`);
    console.log(`   Total: ${testVolunteers.length} accounts\n`);

    if (created > 0) {
      console.log('🔐 Login Credentials:');
      console.log('   Email: volunteer1@gmail.com');
      console.log('   Email: volunteer2@gmail.com');
      console.log('   Email: volunteer3@gmail.com');
      console.log('   Email: john.volunteer@gmail.com');
      console.log('   Email: jane.volunteer@gmail.com');
      console.log('   Password: volunteer123 (for all accounts)\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createTestVolunteers();
