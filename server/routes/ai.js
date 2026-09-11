const express = require('express');
const { 
  generateTeachingNotes,
  createResource,
  getResources,
  askAgent
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Generate teaching notes with RAG
router.post('/generate-notes', generateTeachingNotes);

// Tool-using agent over club data. Any signed-in member may ask; which tools the
// agent gets is decided by role inside agentService, not by this route.
router.post('/ask', askAgent);

// Resource management endpoints
router.route('/resources')
  .get(getResources)
  .post(authorize('admin'), createResource);

module.exports = router;
