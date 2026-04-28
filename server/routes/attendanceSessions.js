const express = require('express');
const {
  createSession,
  generateCode,
  getAllSessions,
  getSession,
  deleteSession
} = require('../controllers/attendanceSessionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes (none)

// Protected routes
router.use(protect);

router.route('/')
  .get(getAllSessions)
  .post(authorize('admin'), createSession);

router.route('/:id')
  .get(getSession)
  .delete(authorize('admin'), deleteSession);

router.post('/:id/generate-code', authorize('admin'), generateCode);

module.exports = router;
