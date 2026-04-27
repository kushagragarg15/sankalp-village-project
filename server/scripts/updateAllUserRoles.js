const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: './.env' });

const updateAllUserRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users\n`);

    let updatedCount = 0;

    for (const user of users) {
      const email = user.email;
      let newRole = user.role;

      // Determine role based on email pattern
      if (email.startsWith('23') || email.startsWith('24')) {
        newRole = 'admin';
      } else if (email.startsWith('25') || email.startsWith('26')) {
        newRole = 'volunteer';
      }

      // Update if role changed
      if (newRole !== user.role) {
        console.log(`Updating: ${user.name} (${email})`);
        console.log(`  ${user.role} → ${newRole}`);
        
        user.role = newRole;
        await user.save();
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
