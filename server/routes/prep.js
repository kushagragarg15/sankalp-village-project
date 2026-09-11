const express = require('express');
const {
  prepareForSession,
  getMyPlanForSession,
  getMyPlans,
  editDraft,
  approveDraft,
  rejectDraft,
  prepareAllForSession,
  getAllForSession
} = require('../controllers/prepController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Coordinator batch view — declared before the volunteer routes so
// "/sessions/:id/all" is not swallowed by "/sessions/:id".
router.route('/sessions/:sessionId/all')
  .get(authorize('admin'), getAllForSession)
  .post(authorize('admin'), prepareAllForSession);

router.route('/sessions/:sessionId')
  .get(getMyPlanForSession)
  .post(prepareForSession);

router.get('/mine', getMyPlans);

// Human-in-the-loop: edit, then approve or reject. Owner only.
router.patch('/:id', editDraft);
router.post('/:id/approve', approveDraft);
router.post('/:id/reject', rejectDraft);

module.exports = router;
