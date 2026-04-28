const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate registrations and optimize queries
registrationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
