const express = require('express');
const { login, logout, getMe, googleAuth, getDemoOptions, demoLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/google', googleAuth);
router.get('/demo', getDemoOptions);
router.post('/demo', demoLogin);

module.exports = router;
