const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
  grade: {
    type: String,
    required: [true, 'Grade/Class is required']
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  parentPhone: {
    type: String,
    default: ''
  },
  // Array of event IDs the student attended
  attendance: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  // Quiz scores per topic
  quizScores: [{
    subject: String,
    topic: String,
    score: Number,
    maxScore: Number,
    date: Date,
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    }
  }]
}, {
  timestamps: true
});

// Virtual for attendance percentage
studentSchema.virtual('attendancePercentage').get(function() {
  // This will be calculated based on total sessions in their village
  return 0; // Placeholder - calculated in controller
});

module.exports = mongoose.model('Student', studentSchema);
