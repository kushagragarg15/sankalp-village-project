const express = require('express');
const { 
  generateTeachingNotes,
  createResource,
  getResources,
  askAgent,
  askAgentStream,
  listConversations,
  getConversation,
  deleteConversation
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');
const { aiRateLimit, aiDailyBudget } = require('../middleware/aiBudget');
const { getActivity, getRun } = require('../controllers/aiAdminController');

const router = express.Router();

router.use(protect);

// Everything below spends model tokens: rate-limited per user, and capped by a
// daily token budget computed from the audit trail (see middleware/aiBudget).
const spend = [aiRateLimit, aiDailyBudget];

// Generate teaching notes with RAG
router.post('/generate-notes', spend, generateTeachingNotes);

// Tool-using agent over club data (LangGraph, in ai-service). Any signed-in
// member may ask; which tools the agent gets is decided by role inside
// ai-service, not by this route — Node only forwards the trusted user context.
router.post('/ask', spend, askAgent);
router.post('/ask/stream', spend, askAgentStream);

// Conversation history: reading and deleting spend nothing, so no guardrails.
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

// Coordinator observability: what the AI did, how it was judged, how evals trend.
router.get('/admin/activity', authorize('admin'), getActivity);
router.get('/admin/runs/:id', authorize('admin'), getRun);

// Resource management endpoints
router.route('/resources')
  .get(getResources)
  .post(authorize('admin'), createResource);

module.exports = router;
