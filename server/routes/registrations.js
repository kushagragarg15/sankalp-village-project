const express = require('express');
const {
  registerForSession,
  getMyRegistrations,
  getSessionRegistrations,
  unregister
} = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/register', registerForSession);
router.get('/my-registrations', getMyRegistrations);
router.get('/session/:sessionId', authorize('admin'), getSessionRegistrations);
router.delete('/:id', unregister);

module.exports = router;
