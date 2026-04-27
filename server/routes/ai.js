const express = require('express');
const { generateTeachingNotes } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/generate-notes', generateTeachingNotes);

module.exports = router;
