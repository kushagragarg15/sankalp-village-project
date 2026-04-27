const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  // QR code for volunteer check-in
  qrCode: {
    type: String,
    unique: true
  },
  // Volunteers who checked in
  volunteersPresent: [{
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    checkInTime: Date,
    checkInMethod: {
      type: String,
      enum: ['qr', 'manual'],
      default: 'qr'
    }
  }],
  // Teaching sessions within this event
  sessions: [{
    subject: {
      type: String,
      required: true,
      enum: ['Math', 'Science', 'English', 'Hindi', 'Social Studies', 'Other']
    },
    topicCovered: {
      type: String,
      required: true
    },
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentsPresent: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],
    notes: String,
    startTime: String,
    endTime: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate unique QR code before saving
eventSchema.pre('save', function(next) {
  if (!this.qrCode) {
    // Generate unique code: EVENT-YYYYMMDD-RANDOMSTRING
    const dateStr = this.date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.qrCode = `EVENT-${dateStr}-${randomStr}`;
  }
  next();
});

// Index for efficient queries
eventSchema.index({ date: -1 });
eventSchema.index({ qrCode: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', eventSchema);
