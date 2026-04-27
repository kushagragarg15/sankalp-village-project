const Student = require('../models/Student');
const Session = require('../models/Session');

// @desc    Get all students
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res, next) => {
  try {
    const students = await Student.find();

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
exports.getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('attendance', 'title date');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student progress
// @route   GET /api/students/:id/progress
// @access  Private
exports.getStudentProgress = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'attendance',
        select: 'title date sessions',
        options: { sort: { date: -1 } }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get total events
    const Event = require('../models/Event');
    const totalEvents = await Event.countDocuments({ status: 'completed' });

    // Calculate attendance percentage
    const attendancePercentage = totalEvents > 0 
      ? Math.round((student.attendance.length / totalEvents) * 100)
      : 0;

    // Group topics by subject from events
    const topicsBySubject = {};
    for (const event of student.attendance) {
      if (event.sessions) {
        event.sessions.forEach(session => {
          if (!topicsBySubject[session.subject]) {
            topicsBySubject[session.subject] = [];
          }
          topicsBySubject[session.subject].push({
            topic: session.topicCovered,
            date: event.date
          });
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          grade: student.grade,
          enrollmentDate: student.enrollmentDate
        },
        attendance: {
          eventsAttended: student.attendance.length,
          totalEvents,
          percentage: attendancePercentage
        },
        topicsCovered: topicsBySubject,
        quizScores: student.quizScores,
        recentEvents: student.attendance.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private
exports.createStudent = async (req, res, next) => {
  try {
    const student = await Student.create(req.body);

    res.status(201).json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
exports.updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add quiz score to student
// @route   POST /api/students/:id/quiz-score
// @access  Private
exports.addQuizScore = async (req, res, next) => {
  try {
    const { subject, topic, score, maxScore } = req.body;

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    student.quizScores.push({
      subject,
      topic,
      score,
      maxScore,
      date: new Date()
    });

    await student.save();

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
