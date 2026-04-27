const express = require('express');
const {
  getSessions,
  getSession,
  getSessionsByVillage,
  getSessionPlanner,
  createSession,
  updateSession,
  deleteSession
} = require('../controllers/sessionController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getSessions)
  .post(createSession);

router.route('/:id')
  .get(getSession)
  .put(updateSession)
  .delete(authorize('admin'), deleteSession);

router.get('/village/:villageId', getSessionsByVillage);
router.get('/planner/:villageId', getSessionPlanner);

module.exports = router;
