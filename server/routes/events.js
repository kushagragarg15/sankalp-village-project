const express = require('express');
const {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  volunteerCheckIn,
  manualVolunteerCheckIn,
  addSession,
  getUpcomingEvents
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getEvents)
  .post(authorize('admin'), createEvent);

router.get('/upcoming', getUpcomingEvents);

router.route('/:id')
  .get(getEvent)
  .put(authorize('admin'), updateEvent)
  .delete(authorize('admin'), deleteEvent);

router.post('/checkin', volunteerCheckIn);
router.post('/:id/checkin-manual', authorize('admin'), manualVolunteerCheckIn);
router.post('/:id/sessions', addSession);

module.exports = router;
