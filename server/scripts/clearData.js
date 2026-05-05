const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Event = require('../models/Event');
const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');
const TeachingLog = require('../models/TeachingLog');
require('dotenv').config({ path: './.env' });

const clearAllData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear all collections
    await User.deleteMany({});
    console.log('✓ Cleared all users');

    await Student.deleteMany({});
    console.log('✓ Cleared all students');

    await Event.deleteMany({});
    console.log('✓ Cleared all events');

    await AttendanceSession.deleteMany({});
    console.log('✓ Cleared all attendance sessions');

    await Registration.deleteMany({});
    console.log('✓ Cleared all registrations');

    await TeachingLog.deleteMany({});
    console.log('✓ Cleared all teaching logs');

    console.log('\n✅ All data cleared successfully!');
    console.log('Database is now empty and ready for production use.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();
