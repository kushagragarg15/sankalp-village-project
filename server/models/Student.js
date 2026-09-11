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
  // Quiz scores per topic
  quizScores: [{
    subject: String,
    topic: String,
    score: Number,
    maxScore: Number,
    date: Date
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
