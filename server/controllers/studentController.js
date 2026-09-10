const Student = require('../models/Student');
const TeachingLog = require('../models/TeachingLog');
const AttendanceSession = require('../models/AttendanceSession');

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
    const student = await Student.findById(req.params.id).lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Progress is derived from TeachingLog, the system that is actually
    // written to today. It used to read `student.attendance` and `Event`,
    // which only the legacy check-in flow ever populated — so this page showed
    // zero sessions and no topics no matter how much teaching was recorded.
    const [logs, totalSessions] = await Promise.all([
      TeachingLog.find({ studentId: student._id })
        .populate('sessionId', 'title startTime')
        .populate('volunteerId', 'name')
        .sort({ timestamp: -1 })
        .lean(),
      AttendanceSession.countDocuments({ endTime: { $lte: new Date() } })
    ]);

    // One session may hold several lessons for the same child.
    const sessionsAttended = new Set(
      logs.map((log) => String(log.sessionId?._id || log.sessionId))
    ).size;

    const topicsCovered = {};
    for (const log of logs) {
      (topicsCovered[log.subject] = topicsCovered[log.subject] || []).push({
        topic: log.topic,
        date: log.timestamp,
        volunteer: log.volunteerId?.name
      });
    }

    const percentage =
      totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0;

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
          eventsAttended: sessionsAttended,
          totalEvents: totalSessions,
          percentage
        },
        topicsCovered,
        quizScores: student.quizScores || [],
        recentSessions: [...new Map(
          logs
            .filter((log) => log.sessionId)
            .map((log) => [String(log.sessionId._id), log.sessionId])
        ).values()].slice(0, 5)
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
    const { subject, topic } = req.body;
    const score = Number(req.body.score);
    const maxScore = Number(req.body.maxScore);

    // None of this was checked before, so a quiz could be stored out of 0 —
    // which the UI then divided by, showing Infinity — or with a score higher
    // than the total.
    if (!subject || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Subject and topic are required'
      });
    }

    if (!Number.isFinite(score) || !Number.isFinite(maxScore)) {
      return res.status(400).json({
        success: false,
        message: 'Score and total must be numbers'
      });
    }

    if (maxScore <= 0) {
      return res.status(400).json({
        success: false,
        message: 'The total must be greater than zero'
      });
    }

    if (score < 0 || score > maxScore) {
      return res.status(400).json({
        success: false,
        message: `Score must be between 0 and ${maxScore}`
      });
    }

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
