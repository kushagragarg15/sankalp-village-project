const express = require('express');
const {
  getAllSyllabus,
  getSyllabus,
  createSyllabus,
  updateSyllabus,
  deleteSyllabus
} = require('../controllers/syllabusController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getAllSyllabus)
  .post(authorize('admin'), createSyllabus);

router.route('/:id')
  .get(getSyllabus)
  .put(authorize('admin'), updateSyllabus)
  .delete(authorize('admin'), deleteSyllabus);

module.exports = router;
