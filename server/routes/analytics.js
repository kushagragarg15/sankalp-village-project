const express = require('express');
const {
  getDashboardStats,
  getOverview
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/overview', getOverview);
router.get('/dashboard', getDashboardStats);

module.exports = router;
