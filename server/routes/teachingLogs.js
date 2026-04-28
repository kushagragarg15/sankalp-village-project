const express = require('express');
const {
  submitTeachingLog,
  getMyLogs,
  getSessionLogs,
  getAllLogs
} = require('../controllers/teachingLogController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/submit', submitTeachingLog);
router.get('/my-logs', getMyLogs);
router.get('/session/:sessionId', authorize('admin'), getSessionLogs);
router.get('/', authorize('admin'), getAllLogs);

module.exports = router;
