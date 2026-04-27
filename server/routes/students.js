const express = require('express');
const {
  getStudents,
  getStudent,
  getStudentProgress,
  createStudent,
  updateStudent,
  addQuizScore,
  deleteStudent
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getStudents)
  .post(createStudent);

router.route('/:id')
  .get(getStudent)
  .put(updateStudent)
  .delete(authorize('admin'), deleteStudent);

router.get('/:id/progress', getStudentProgress);
router.post('/:id/quiz-score', addQuizScore);

module.exports = router;
