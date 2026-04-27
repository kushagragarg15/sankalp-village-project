const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  volunteer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Volunteer is required']
  },
  village: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village',
    required: [true, 'Village is required']
  },
  date: {
    type: Date,
    required: [true, 'Session date is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: ['Math', 'Science', 'English', 'Hindi', 'Social Studies', 'Other']
  },
  topicCovered: {
    type: String,
    required: [true, 'Topic covered is required'],
    trim: true
  },
  // Array of student IDs who attended
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
sessionSchema.index({ village: 1, date: -1 });
sessionSchema.index({ volunteer: 1, date: -1 });

module.exports = mongoose.model('Session', sessionSchema);
