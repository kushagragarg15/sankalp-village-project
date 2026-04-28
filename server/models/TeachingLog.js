const mongoose = require('mongoose');

const teachingLogSchema = new mongoose.Schema({
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  codeUsed: {
    type: String,
    required: true
  },
  lat: {
    type: Number,
    default: null
  },
  lng: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicates and optimize queries
teachingLogSchema.index({ sessionId: 1, volunteerId: 1, studentId: 1 }, { unique: true });
teachingLogSchema.index({ volunteerId: 1, timestamp: -1 });

module.exports = mongoose.model('TeachingLog', teachingLogSchema);
