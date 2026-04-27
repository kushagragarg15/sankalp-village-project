const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: './.env' });

const updateUserRole = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const email = '23ucc564@lnmiit.ac.in';

    // Find and update the user
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    console.log(`Found user: ${user.name} (${user.email})`);
    console.log(`Current role: ${user.role}`);

    // Update role to admin
    user.role = 'admin';
    await user.save();

    console.log(`✅ Updated role to: ${user.role}`);
    console.log('\nPlease log out and log back in to see the changes.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  }
};

updateUserRole();
