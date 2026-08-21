const express = require('express');
const { 
  generateTeachingNotes,
  createResource,
  getResources 
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Generate teaching notes with RAG
router.post('/generate-notes', generateTeachingNotes);

// Resource management endpoints
router.route('/resources')
  .get(getResources)
  .post(authorize('admin'), createResource);

module.exports = router;
