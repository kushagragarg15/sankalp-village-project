const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: ['Math', 'Science', 'English', 'Hindi', 'Social Studies', 'Other']
  },
  grade: {
    type: String,
    required: [true, 'Grade is required']
  },
  topics: [{
    order: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    }
  }]
}, {
  timestamps: true
});

// Compound index to ensure unique subject-grade combinations
syllabusSchema.index({ subject: 1, grade: 1 }, { unique: true });

module.exports = mongoose.model('Syllabus', syllabusSchema);
