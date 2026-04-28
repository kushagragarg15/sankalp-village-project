require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');

const testStudents = [
  // Grade 1
  {
    name: 'Aarav Kumar',
    grade: 'Grade 1',
    parentPhone: '9876543201',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Diya Sharma',
    grade: 'Grade 1',
    parentPhone: '9876543202',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Arjun Patel',
    grade: 'Grade 1',
    parentPhone: '9876543203',
    enrollmentDate: new Date('2024-01-20')
  },
  
  // Grade 2
  {
    name: 'Ananya Singh',
    grade: 'Grade 2',
    parentPhone: '9876543204',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Vihaan Gupta',
    grade: 'Grade 2',
    parentPhone: '9876543205',
    enrollmentDate: new Date('2024-01-18')
  },
  {
    name: 'Saanvi Reddy',
    grade: 'Grade 2',
    parentPhone: '9876543206',
    enrollmentDate: new Date('2024-01-22')
  },
  
  // Grade 3
  {
    name: 'Aditya Verma',
    grade: 'Grade 3',
    parentPhone: '9876543207',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Isha Joshi',
    grade: 'Grade 3',
    parentPhone: '9876543208',
    enrollmentDate: new Date('2024-01-16')
  },
  {
    name: 'Reyansh Yadav',
    grade: 'Grade 3',
    parentPhone: '9876543209',
    enrollmentDate: new Date('2024-01-19')
  },
  {
    name: 'Myra Desai',
    grade: 'Grade 3',
    parentPhone: '9876543210',
    enrollmentDate: new Date('2024-01-21')
  },
  
  // Grade 4
  {
    name: 'Kabir Mehta',
    grade: 'Grade 4',
    parentPhone: '9876543211',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Navya Iyer',
    grade: 'Grade 4',
    parentPhone: '9876543212',
    enrollmentDate: new Date('2024-01-17')
  },
  {
    name: 'Shaurya Nair',
    grade: 'Grade 4',
    parentPhone: '9876543213',
    enrollmentDate: new Date('2024-01-20')
  },
  
  // Grade 5
  {
    name: 'Aanya Kapoor',
    grade: 'Grade 5',
    parentPhone: '9876543214',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Vivaan Malhotra',
    grade: 'Grade 5',
    parentPhone: '9876543215',
    enrollmentDate: new Date('2024-01-16')
  },
  {
    name: 'Kiara Bose',
    grade: 'Grade 5',
    parentPhone: '9876543216',
    enrollmentDate: new Date('2024-01-18')
  },
  {
    name: 'Ayaan Saxena',
    grade: 'Grade 5',
    parentPhone: '9876543217',
    enrollmentDate: new Date('2024-01-22')
  },
  
  // Grade 6
  {
    name: 'Pari Agarwal',
    grade: 'Grade 6',
    parentPhone: '9876543218',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Atharv Pandey',
    grade: 'Grade 6',
    parentPhone: '9876543219',
    enrollmentDate: new Date('2024-01-17')
  },
  {
    name: 'Riya Mishra',
    grade: 'Grade 6',
    parentPhone: '9876543220',
    enrollmentDate: new Date('2024-01-19')
  },
  
  // Grade 7
  {
    name: 'Dhruv Chauhan',
    grade: 'Grade 7',
    parentPhone: '9876543221',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Anvi Thakur',
    grade: 'Grade 7',
    parentPhone: '9876543222',
    enrollmentDate: new Date('2024-01-16')
  },
  {
    name: 'Arnav Jain',
    grade: 'Grade 7',
    parentPhone: '9876543223',
    enrollmentDate: new Date('2024-01-20')
  },
  
  // Grade 8
  {
    name: 'Siya Bansal',
    grade: 'Grade 8',
    parentPhone: '9876543224',
    enrollmentDate: new Date('2024-01-15')
  },
  {
    name: 'Ishaan Sinha',
    grade: 'Grade 8',
    parentPhone: '9876543225',
    enrollmentDate: new Date('2024-01-18')
  },
  {
    name: 'Avni Bhatt',
    grade: 'Grade 8',
    parentPhone: '9876543226',
    enrollmentDate: new Date('2024-01-21')
  }
];

const createTestStudents = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('Creating test student accounts...\n');

    let created = 0;
    let skipped = 0;

    for (const studentData of testStudents) {
      // Check if student already exists
      const existingStudent = await Student.findOne({ 
        name: studentData.name,
        grade: studentData.grade 
      });

      if (existingStudent) {
        console.log(`⏭️  Skipped: ${studentData.name} (${studentData.grade}) - already exists`);
        skipped++;
        continue;
      }

      // Create new student
      const student = await Student.create(studentData);
      console.log(`✅ Created: ${student.name} (${student.grade})`);
      created++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created} students`);
    console.log(`   Skipped: ${skipped} students (already existed)`);
    console.log(`   Total: ${testStudents.length} students\n`);

    if (created > 0) {
      // Count by grade
      const gradeCounts = {};
      for (const student of testStudents) {
        gradeCounts[student.grade] = (gradeCounts[student.grade] || 0) + 1;
      }

      console.log('📚 Students by Grade:');
      Object.keys(gradeCounts).sort().forEach(grade => {
        console.log(`   ${grade}: ${gradeCounts[grade]} students`);
      });
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createTestStudents();
