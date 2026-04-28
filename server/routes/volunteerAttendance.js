const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllVolunteerAttendance,
  getMyAttendance,
  getVolunteerAttendance
} = require('../controllers/volunteerAttendanceController');

// Protect all routes
router.use(protect);

// Get my attendance (any authenticated user)
router.get('/my-attendance', getMyAttendance);

// Get all volunteers attendance (admin only)
router.get('/', authorize('admin'), getAllVolunteerAttendance);

// Get specific volunteer attendance (admin only)
router.get('/:volunteerId', authorize('admin'), getVolunteerAttendance);

module.exports = router;
