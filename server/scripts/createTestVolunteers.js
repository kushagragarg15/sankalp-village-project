require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const testVolunteers = [
  {
    name: 'Rahul Sharma',
    email: 'rahul.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543210'
  },
  {
    name: 'Priya Patel',
    email: 'priya.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543211'
  },
  {
    name: 'Amit Kumar',
    email: 'amit.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543212'
  },
  {
    name: 'Sneha Reddy',
    email: 'sneha.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543213'
  },
  {
    name: 'Vikram Singh',
    email: 'vikram.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543214'
  },
  {
    name: 'Anjali Mehta',
    email: 'anjali.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543215'
  },
  {
    name: 'Arjun Gupta',
    email: 'arjun.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543216'
  },
  {
    name: 'Kavita Desai',
    email: 'kavita.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543217'
  },
  {
    name: 'Raj Malhotra',
    email: 'raj.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543218'
  },
  {
    name: 'Neha Kapoor',
    email: 'neha.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543219'
  },
  {
    name: 'Sanjay Verma',
    email: 'sanjay.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543220'
  },
  {
    name: 'Pooja Joshi',
    email: 'pooja.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543221'
  },
  {
    name: 'Karan Nair',
    email: 'karan.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543222'
  },
  {
    name: 'Divya Iyer',
    email: 'divya.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543223'
  },
  {
    name: 'Rohan Saxena',
    email: 'rohan.volunteer@gmail.com',
    password: 'volunteer123',
    role: 'volunteer',
    phone: '9876543224'
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
      console.log('   Email: rahul.volunteer@gmail.com');
      console.log('   Email: priya.volunteer@gmail.com');
      console.log('   Email: amit.volunteer@gmail.com');
      console.log('   Email: sneha.volunteer@gmail.com');
      console.log('   Email: vikram.volunteer@gmail.com');
      console.log('   ... and 10 more volunteer accounts');
      console.log('   Password: volunteer123 (for all accounts)\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createTestVolunteers();
