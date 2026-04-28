const TeachingLog = require('../models/TeachingLog');
const User = require('../models/User');
const AttendanceSession = require('../models/AttendanceSession');

// @desc    Get all volunteers with their attendance stats
// @route   GET /api/volunteer-attendance
// @access  Private (Admin only)
exports.getAllVolunteerAttendance = async (req, res, next) => {
  try {
    // Get all volunteers
    const volunteers = await User.find({ role: 'volunteer' }).select('name email phone');

    // Get attendance stats for each volunteer
    const volunteerStats = await Promise.all(
      volunteers.map(async (volunteer) => {
        // Count unique sessions attended
        const sessionsAttended = await TeachingLog.distinct('sessionId', {
          volunteerId: volunteer._id
        });

        // Count total teaching logs
        const totalLogs = await TeachingLog.countDocuments({
          volunteerId: volunteer._id
        });

        // Get recent sessions
        const recentLogs = await TeachingLog.find({
          volunteerId: volunteer._id
        })
          .populate('sessionId', 'title startTime')
          .sort({ timestamp: -1 })
          .limit(5);

        return {
          _id: volunteer._id,
          name: volunteer.name,
          email: volunteer.email,
          phone: volunteer.phone,
          sessionsAttended: sessionsAttended.length,
          totalStudentsTaught: totalLogs,
          recentSessions: recentLogs.map(log => ({
            sessionTitle: log.sessionId?.title,
            date: log.timestamp
          }))
        };
      })
    );

    res.status(200).json({
      success: true,
      count: volunteerStats.length,
      data: volunteerStats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my attendance as a volunteer
// @route   GET /api/volunteer-attendance/my-attendance
// @access  Private
exports.getMyAttendance = async (req, res, next) => {
  try {
    // Get unique sessions attended
    const sessionsAttended = await TeachingLog.distinct('sessionId', {
      volunteerId: req.user.id
    });

    // Get detailed logs with session and student info
    const logs = await TeachingLog.find({
      volunteerId: req.user.id
    })
      .populate('sessionId', 'title startTime endTime')
      .populate('studentId', 'name grade')
      .sort({ timestamp: -1 });

    // Group by session
    const sessionGroups = {};
    logs.forEach(log => {
      const sessionId = log.sessionId?._id?.toString();
      if (!sessionId) return;

      if (!sessionGroups[sessionId]) {
        sessionGroups[sessionId] = {
          session: {
            id: log.sessionId._id,
            title: log.sessionId.title,
            startTime: log.sessionId.startTime,
            endTime: log.sessionId.endTime
          },
          students: [],
          submittedAt: log.timestamp
        };
      }

      sessionGroups[sessionId].students.push({
        name: log.studentId?.name,
        grade: log.studentId?.grade,
        subject: log.subject,
        topic: log.topic
      });
    });

    const attendanceHistory = Object.values(sessionGroups);

    res.status(200).json({
      success: true,
      data: {
        totalSessions: sessionsAttended.length,
        totalStudentsTaught: logs.length,
        attendanceHistory
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get specific volunteer's attendance (Admin)
// @route   GET /api/volunteer-attendance/:volunteerId
// @access  Private (Admin only)
exports.getVolunteerAttendance = async (req, res, next) => {
  try {
    const volunteer = await User.findById(req.params.volunteerId).select('name email phone');

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    // Get unique sessions attended
    const sessionsAttended = await TeachingLog.distinct('sessionId', {
      volunteerId: req.params.volunteerId
    });

    // Get detailed logs
    const logs = await TeachingLog.find({
      volunteerId: req.params.volunteerId
    })
      .populate('sessionId', 'title startTime endTime')
      .populate('studentId', 'name grade')
      .sort({ timestamp: -1 });

    // Group by session
    const sessionGroups = {};
    logs.forEach(log => {
      const sessionId = log.sessionId?._id?.toString();
      if (!sessionId) return;

      if (!sessionGroups[sessionId]) {
        sessionGroups[sessionId] = {
          session: {
            id: log.sessionId._id,
            title: log.sessionId.title,
            startTime: log.sessionId.startTime,
            endTime: log.sessionId.endTime
          },
          students: [],
          submittedAt: log.timestamp
        };
      }

      sessionGroups[sessionId].students.push({
        name: log.studentId?.name,
        grade: log.studentId?.grade,
        subject: log.subject,
        topic: log.topic
      });
    });

    const attendanceHistory = Object.values(sessionGroups);

    res.status(200).json({
      success: true,
      data: {
        volunteer: {
          id: volunteer._id,
          name: volunteer.name,
          email: volunteer.email,
          phone: volunteer.phone
        },
        totalSessions: sessionsAttended.length,
        totalStudentsTaught: logs.length,
        attendanceHistory
      }
    });
  } catch (error) {
    next(error);
  }
};
