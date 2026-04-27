const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Student = require('../models/Student');
const Event = require('../models/Event');
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
    await Student.deleteMany();
    await Event.deleteMany();
    await Syllabus.deleteMany();

    console.log('Cleared existing data...');

    // Create admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@sankalpvillage.org',
      password: 'admin123',
      role: 'admin',
      phone: '+91 98765 43210'
    });

    // Create volunteers
    const volunteer1 = await User.create({
      name: 'Priya Sharma',
      email: 'priya@sankalpvillage.org',
      password: 'volunteer123',
      role: 'volunteer',
      phone: '+91 98765 43211'
    });

    const volunteer2 = await User.create({
      name: 'Rahul Kumar',
      email: 'rahul@sankalpvillage.org',
      password: 'volunteer123',
      role: 'volunteer',
      phone: '+91 98765 43212'
    });

    const volunteer3 = await User.create({
      name: 'Anjali Verma',
      email: 'anjali@sankalpvillage.org',
      password: 'volunteer123',
      role: 'volunteer',
      phone: '+91 98765 43213'
    });

    console.log('Users created...');

    // Create students
    const students = await Student.create([
      { name: 'Aarav Singh', grade: 'Class 5', enrollmentDate: new Date('2025-01-15'), parentPhone: '+91 98111 11111' },
      { name: 'Diya Patel', grade: 'Class 5', enrollmentDate: new Date('2025-01-15'), parentPhone: '+91 98111 11112' },
      { name: 'Arjun Verma', grade: 'Class 5', enrollmentDate: new Date('2025-02-01'), parentPhone: '+91 98111 11113' },
      { name: 'Ananya Gupta', grade: 'Class 5', enrollmentDate: new Date('2025-02-01'), parentPhone: '+91 98111 11114' },
      { name: 'Vivaan Yadav', grade: 'Class 5', enrollmentDate: new Date('2025-02-10'), parentPhone: '+91 98111 11115' },
      { name: 'Ishaan Mishra', grade: 'Class 6', enrollmentDate: new Date('2025-01-20'), parentPhone: '+91 98111 11116' },
      { name: 'Saanvi Reddy', grade: 'Class 6', enrollmentDate: new Date('2025-01-20'), parentPhone: '+91 98111 11117' },
      { name: 'Aditya Joshi', grade: 'Class 6', enrollmentDate: new Date('2025-02-05'), parentPhone: '+91 98111 11118' },
      { name: 'Myra Kapoor', grade: 'Class 4', enrollmentDate: new Date('2025-02-05'), parentPhone: '+91 98111 11119' },
      { name: 'Reyansh Sharma', grade: 'Class 4', enrollmentDate: new Date('2025-02-15'), parentPhone: '+91 98111 11120' }
    ]);

    console.log('Students created...');

    // Create past events
    const event1 = await Event.create({
      title: 'Weekend Learning Session - March 15',
      date: new Date('2026-03-15'),
      startTime: '10:00 AM',
      endTime: '02:00 PM',
      description: 'Math and English classes for Class 5 students',
      status: 'completed',
      createdBy: admin._id,
      volunteersPresent: [
        { volunteer: volunteer1._id, checkInTime: new Date('2026-03-15T09:45:00'), checkInMethod: 'qr' },
        { volunteer: volunteer2._id, checkInTime: new Date('2026-03-15T09:50:00'), checkInMethod: 'qr' }
      ],
      sessions: [
        {
          subject: 'Math',
          topicCovered: 'Introduction to Fractions',
          volunteer: volunteer1._id,
          studentsPresent: [students[0]._id, students[1]._id, students[2]._id, students[3]._id],
          notes: 'Students showed good understanding of basic fraction concepts.',
          startTime: '10:00 AM',
          endTime: '11:30 AM'
        },
        {
          subject: 'English',
          topicCovered: 'Parts of Speech - Nouns',
          volunteer: volunteer2._id,
          studentsPresent: [students[0]._id, students[1]._id, students[2]._id],
          notes: 'Interactive session with examples from daily life.',
          startTime: '11:45 AM',
          endTime: '01:15 PM'
        }
      ]
    });

    const event2 = await Event.create({
      title: 'Weekend Learning Session - March 22',
      date: new Date('2026-03-22'),
      startTime: '10:00 AM',
      endTime: '02:00 PM',
      description: 'Math and Science classes',
      status: 'completed',
      createdBy: admin._id,
      volunteersPresent: [
        { volunteer: volunteer1._id, checkInTime: new Date('2026-03-22T09:40:00'), checkInMethod: 'qr' },
        { volunteer: volunteer3._id, checkInTime: new Date('2026-03-22T09:55:00'), checkInMethod: 'manual' }
      ],
      sessions: [
        {
          subject: 'Math',
          topicCovered: 'Adding Fractions',
          volunteer: volunteer1._id,
          studentsPresent: [students[0]._id, students[1]._id, students[3]._id, students[4]._id],
          notes: 'Covered addition of fractions with same denominators.',
          startTime: '10:00 AM',
          endTime: '11:30 AM'
        },
        {
          subject: 'Science',
          topicCovered: 'Water Cycle',
          volunteer: volunteer3._id,
          studentsPresent: [students[0]._id, students[1]._id, students[3]._id, students[4]._id],
          notes: 'Used diagrams to explain evaporation and condensation.',
          startTime: '11:45 AM',
          endTime: '01:15 PM'
        }
      ]
    });

    // Create upcoming event
    const upcomingEvent = await Event.create({
      title: 'Weekend Learning Session - May 3',
      date: new Date('2026-05-03'),
      startTime: '10:00 AM',
      endTime: '02:00 PM',
      description: 'Math, Science, and English classes for all grades',
      status: 'upcoming',
      createdBy: admin._id,
      volunteersPresent: [],
      sessions: []
    });

    console.log('Events created...');

    // Update student attendance
    await Student.findByIdAndUpdate(students[0]._id, {
      $push: { attendance: { $each: [event1._id, event2._id] } }
    });
    await Student.findByIdAndUpdate(students[1]._id, {
      $push: { attendance: { $each: [event1._id, event2._id] } }
    });
    await Student.findByIdAndUpdate(students[2]._id, {
      $push: { attendance: event1._id }
    });
    await Student.findByIdAndUpdate(students[3]._id, {
      $push: { attendance: { $each: [event1._id, event2._id] } }
    });
    await Student.findByIdAndUpdate(students[4]._id, {
      $push: { attendance: event2._id }
    });

    // Update volunteer attendance
    await User.findByIdAndUpdate(volunteer1._id, {
      $push: {
        attendance: {
          $each: [
            { event: event1._id, checkInTime: new Date('2026-03-15T09:45:00'), checkInMethod: 'qr' },
            { event: event2._id, checkInTime: new Date('2026-03-22T09:40:00'), checkInMethod: 'qr' }
          ]
        }
      }
    });

    await User.findByIdAndUpdate(volunteer2._id, {
      $push: {
        attendance: {
          event: event1._id,
          checkInTime: new Date('2026-03-15T09:50:00'),
          checkInMethod: 'qr'
        }
      }
    });

    await User.findByIdAndUpdate(volunteer3._id, {
      $push: {
        attendance: {
          event: event2._id,
          checkInTime: new Date('2026-03-22T09:55:00'),
          checkInMethod: 'manual'
        }
      }
    });

    // Add quiz scores
    await Student.findByIdAndUpdate(students[0]._id, {
      $push: {
        quizScores: {
          $each: [
            { subject: 'Math', topic: 'Fractions', score: 7, maxScore: 10, date: new Date('2026-03-16'), event: event1._id },
            { subject: 'Math', topic: 'Adding Fractions', score: 9, maxScore: 10, date: new Date('2026-03-23'), event: event2._id }
          ]
        }
      }
    });

    console.log('Attendance and quiz scores updated...');

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
    console.log('Volunteer 3: anjali@sankalpvillage.org / volunteer123');
    console.log('\nUpcoming Event QR Code:', upcomingEvent.qrCode);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
