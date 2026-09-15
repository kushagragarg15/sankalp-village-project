const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users, students, attendanceSessions, registrations, teachingLogs } = require('../db/schema');
require('dotenv').config({ path: './.env' });

const clearAllData = async () => {
  try {
    await connectPG();
    const db = getDb();

    // Children before the parents they reference.
    await db.delete(teachingLogs);
    console.log('✓ Cleared all teaching logs');

    await db.delete(registrations);
    console.log('✓ Cleared all registrations');

    await db.delete(attendanceSessions);
    console.log('✓ Cleared all attendance sessions');

    await db.delete(students); // quiz_scores cascade with their student
    console.log('✓ Cleared all students');

    await db.delete(users);
    console.log('✓ Cleared all users');

    console.log('\n✅ All data cleared successfully!');
    console.log('Database is now empty and ready for production use.');

    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
};

clearAllData();
