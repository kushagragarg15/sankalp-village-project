const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Session = require('../models/Session');
const Village = require('../models/Village');
const Syllabus = require('../models/Syllabus');
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

    await Session.deleteMany({});
    console.log('✓ Cleared all sessions');

    await Village.deleteMany({});
    console.log('✓ Cleared all villages');

    await Syllabus.deleteMany({});
    console.log('✓ Cleared all syllabus data');

    console.log('\n✅ All data cleared successfully!');
    console.log('Database is now empty and ready for production use.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();
