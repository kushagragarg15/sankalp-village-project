const mongoose = require('mongoose');

const attendanceSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  activeCode: {
    type: String,
    default: null
  },
  codeExpiry: {
    type: Date,
    default: null
  },
  location: {
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSessionSchema.index({ startTime: 1, endTime: 1 });
attendanceSessionSchema.index({ activeCode: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
