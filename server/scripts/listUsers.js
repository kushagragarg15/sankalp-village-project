require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const listUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find().select('name email role googleId');
    
    console.log('\n=== Current Users in Database ===\n');
    
    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Google ID: ${user.googleId ? 'Yes' : 'No'}`);
        console.log('');
      });
      
      console.log(`Total users: ${users.length}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

listUsers();
