const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Village = require('../models/Village');
const Student = require('../models/Student');
const Session = require('../models/Session');
const Syllabus = require('../models/Syllabus');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Village.deleteMany();
    await Student.deleteMany();
    await Session.deleteMany();
    await Syllabus.deleteMany();

    console.log('Cleared existing data...');

    // Create villages
    const rampur = await Village.create({
      name: 'Rampur',
      district: 'Bareilly',
      state: 'Uttar Pradesh'
    });

    const shivgarh = await Village.create({
      name: 'Shivgarh',
      district: 'Rae Bareli',
      state: 'Uttar Pradesh'
    });

    console.log('Villages created...');

    // Create admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@sankalpvillage.org',
      password: 'admin123',
      role: 'admin'
    });

    // Create volunteers
    const volunteer1 = await User.create({
      name: 'Priya Sharma',
      email: 'priya@sankalpvillage.org',
      password: 'volunteer123',
      role: 'volunteer',
      assignedVillage: rampur._id
    });

    const volunteer2 = await User.create({
      name: 'Rahul Kumar',
      email: 'rahul@sankalpvillage.org',
      password: 'volunteer123',
      role: 'volunteer',
      assignedVillage: shivgarh._id
    });

    // Update villages with assigned volunteers
    rampur.assignedVolunteers.push(volunteer1._id);
    await rampur.save();

    shivgarh.assignedVolunteers.push(volunteer2._id);
    await shivgarh.save();

    console.log('Users created...');

    // Create students for Rampur
    const rampurStudents = await Student.create([
      { name: 'Aarav Singh', village: rampur._id, grade: 'Class 5', enrollmentDate: new Date('2025-01-15') },
      { name: 'Diya Patel', village: rampur._id, grade: 'Class 5', enrollmentDate: new Date('2025-01-15') },
      { name: 'Arjun Verma', village: rampur._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-01') },
      { name: 'Ananya Gupta', village: rampur._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-01') },
      { name: 'Vivaan Yadav', village: rampur._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-10') }
    ]);

    // Create students for Shivgarh
    const shivgarhStudents = await Student.create([
      { name: 'Ishaan Mishra', village: shivgarh._id, grade: 'Class 5', enrollmentDate: new Date('2025-01-20') },
      { name: 'Saanvi Reddy', village: shivgarh._id, grade: 'Class 5', enrollmentDate: new Date('2025-01-20') },
      { name: 'Aditya Joshi', village: shivgarh._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-05') },
      { name: 'Myra Kapoor', village: shivgarh._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-05') },
      { name: 'Reyansh Sharma', village: shivgarh._id, grade: 'Class 5', enrollmentDate: new Date('2025-02-15') }
    ]);

    console.log('Students created...');

    // Create past sessions for Rampur
    const session1 = await Session.create({
      volunteer: volunteer1._id,
      village: rampur._id,
      date: new Date('2026-03-15'),
      subject: 'Math',
      topicCovered: 'Introduction to Fractions',
      attendees: [rampurStudents[0]._id, rampurStudents[1]._id, rampurStudents[2]._id, rampurStudents[3]._id],
      notes: 'Students showed good understanding of basic fraction concepts. Need more practice with visual representations.'
    });

    const session2 = await Session.create({
      volunteer: volunteer1._id,
      village: rampur._id,
      date: new Date('2026-03-22'),
      subject: 'Math',
      topicCovered: 'Adding Fractions',
      attendees: [rampurStudents[0]._id, rampurStudents[1]._id, rampurStudents[3]._id, rampurStudents[4]._id],
      notes: 'Covered addition of fractions with same denominators. Used pie charts for visualization.'
    });

    const session3 = await Session.create({
      volunteer: volunteer1._id,
      village: rampur._id,
      date: new Date('2026-04-05'),
      subject: 'English',
      topicCovered: 'Parts of Speech - Nouns',
      attendees: [rampurStudents[0]._id, rampurStudents[1]._id, rampurStudents[2]._id],
      notes: 'Interactive session with examples from daily life. Students participated actively.'
    });

    // Create past sessions for Shivgarh
    const session4 = await Session.create({
      volunteer: volunteer2._id,
      village: shivgarh._id,
      date: new Date('2026-03-18'),
      subject: 'Math',
      topicCovered: 'Introduction to Fractions',
      attendees: [shivgarhStudents[0]._id, shivgarhStudents[1]._id, shivgarhStudents[2]._id],
      notes: 'Good session. Students grasped the concept of numerator and denominator.'
    });

    const session5 = await Session.create({
      volunteer: volunteer2._id,
      village: shivgarh._id,
      date: new Date('2026-04-01'),
      subject: 'Science',
      topicCovered: 'Water Cycle',
      attendees: [shivgarhStudents[0]._id, shivgarhStudents[1]._id, shivgarhStudents[3]._id, shivgarhStudents[4]._id],
      notes: 'Used diagrams to explain evaporation, condensation, and precipitation. Very engaging.'
    });

    const session6 = await Session.create({
      volunteer: volunteer2._id,
      village: shivgarh._id,
      date: new Date('2026-04-15'),
      subject: 'English',
      topicCovered: 'Simple Sentences',
      attendees: [shivgarhStudents[1]._id, shivgarhStudents[2]._id, shivgarhStudents[3]._id],
      notes: 'Practiced forming simple sentences. Need more work on subject-verb agreement.'
    });

    // Update student attendance
    await Student.findByIdAndUpdate(rampurStudents[0]._id, {
      $push: { attendance: { $each: [session1._id, session2._id, session3._id] } }
    });
    await Student.findByIdAndUpdate(rampurStudents[1]._id, {
      $push: { attendance: { $each: [session1._id, session2._id, session3._id] } }
    });
    await Student.findByIdAndUpdate(rampurStudents[2]._id, {
      $push: { attendance: { $each: [session1._id, session3._id] } }
    });
    await Student.findByIdAndUpdate(rampurStudents[3]._id, {
      $push: { attendance: { $each: [session1._id, session2._id] } }
    });
    await Student.findByIdAndUpdate(rampurStudents[4]._id, {
      $push: { attendance: session2._id }
    });

    await Student.findByIdAndUpdate(shivgarhStudents[0]._id, {
      $push: { attendance: { $each: [session4._id, session5._id] } }
    });
    await Student.findByIdAndUpdate(shivgarhStudents[1]._id, {
      $push: { attendance: { $each: [session4._id, session5._id, session6._id] } }
    });
    await Student.findByIdAndUpdate(shivgarhStudents[2]._id, {
      $push: { attendance: { $each: [session4._id, session6._id] } }
    });
    await Student.findByIdAndUpdate(shivgarhStudents[3]._id, {
      $push: { attendance: { $each: [session5._id, session6._id] } }
    });
    await Student.findByIdAndUpdate(shivgarhStudents[4]._id, {
      $push: { attendance: session5._id }
    });

    // Add some quiz scores
    await Student.findByIdAndUpdate(rampurStudents[0]._id, {
      $push: {
        quizScores: {
          $each: [
            { subject: 'Math', topic: 'Fractions', score: 7, maxScore: 10, date: new Date('2026-03-16') },
            { subject: 'Math', topic: 'Adding Fractions', score: 9, maxScore: 10, date: new Date('2026-03-23') }
          ]
        }
      }
    });

    await Student.findByIdAndUpdate(rampurStudents[1]._id, {
      $push: {
        quizScores: {
          $each: [
            { subject: 'Math', topic: 'Fractions', score: 6, maxScore: 10, date: new Date('2026-03-16') },
            { subject: 'Math', topic: 'Adding Fractions', score: 8, maxScore: 10, date: new Date('2026-03-23') }
          ]
        }
      }
    });

    console.log('Sessions created...');

    // Create syllabus for Math Class 5
    await Syllabus.create({
      subject: 'Math',
      grade: 'Class 5',
      topics: [
        { order: 1, title: 'Introduction to Fractions', description: 'Understanding numerator and denominator' },
        { order: 2, title: 'Adding Fractions', description: 'Addition of fractions with same denominators' },
        { order: 3, title: 'Subtracting Fractions', description: 'Subtraction of fractions with same denominators' },
        { order: 4, title: 'Comparing Fractions', description: 'Using <, >, = to compare fractions' },
        { order: 5, title: 'Decimals', description: 'Introduction to decimal numbers' },
        { order: 6, title: 'Adding Decimals', description: 'Addition of decimal numbers' },
        { order: 7, title: 'Geometry Basics', description: 'Lines, angles, and shapes' },
        { order: 8, title: 'Perimeter', description: 'Calculating perimeter of shapes' }
      ]
    });

    // Create syllabus for English Class 5
    await Syllabus.create({
      subject: 'English',
      grade: 'Class 5',
      topics: [
        { order: 1, title: 'Parts of Speech - Nouns', description: 'Common and proper nouns' },
        { order: 2, title: 'Parts of Speech - Verbs', description: 'Action words and helping verbs' },
        { order: 3, title: 'Parts of Speech - Adjectives', description: 'Describing words' },
        { order: 4, title: 'Simple Sentences', description: 'Subject and predicate' },
        { order: 5, title: 'Compound Sentences', description: 'Using conjunctions' },
        { order: 6, title: 'Reading Comprehension', description: 'Understanding short passages' },
        { order: 7, title: 'Letter Writing', description: 'Formal and informal letters' },
        { order: 8, title: 'Story Writing', description: 'Creating simple narratives' }
      ]
    });

    console.log('Syllabus created...');

    console.log('\n✅ Seed data created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@sankalpvillage.org / admin123');
    console.log('Volunteer 1: priya@sankalpvillage.org / volunteer123');
    console.log('Volunteer 2: rahul@sankalpvillage.org / volunteer123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
