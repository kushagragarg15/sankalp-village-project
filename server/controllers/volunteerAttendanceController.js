const TeachingLog = require('../models/TeachingLog');
const User = require('../models/User');

/**
 * Sessions attended, per volunteer, in ONE round trip.
 *
 * This replaces a `TeachingLog.distinct()` call per volunteer. That pattern
 * cost 1 + N round trips to Atlas (~30ms each), so it grew linearly with the
 * number of volunteers no matter how little data there was.
 *
 * Returns a Map of volunteerId -> distinct session count.
 */
const sessionCountsByVolunteer = async () => {
  const rows = await TeachingLog.aggregate([
    // One entry per (volunteer, session) pair...
    { $group: { _id: { volunteerId: '$volunteerId', sessionId: '$sessionId' } } },
    // ...then count the pairs per volunteer.
    { $group: { _id: '$_id.volunteerId', sessionsAttended: { $sum: 1 } } }
  ]);

  return new Map(rows.map((row) => [String(row._id), row.sessionsAttended]));
};

// Ranked highest-first, with volunteers who have taught nothing included at 0.
const rankVolunteers = (volunteers, counts) => {
  const ranked = volunteers.map((volunteer) => ({
    _id: volunteer._id,
    name: volunteer.name,
    email: volunteer.email,
    phone: volunteer.phone,
    sessionsAttended: counts.get(String(volunteer._id)) || 0
  }));

  ranked.sort((a, b) => b.sessionsAttended - a.sessionsAttended);
  ranked.forEach((volunteer, index) => {
    volunteer.rank = index + 1;
  });

  return ranked;
};

// Fold a volunteer's logs into one entry per session.
const groupLogsBySession = (logs) => {
  const groups = new Map();

  for (const log of logs) {
    const session = log.sessionId;
    if (!session?._id) continue;

    const key = String(session._id);
    if (!groups.has(key)) {
      groups.set(key, {
        session: {
          id: session._id,
          title: session.title,
          startTime: session.startTime,
          endTime: session.endTime
        },
        students: [],
        submittedAt: log.timestamp
      });
    }

    groups.get(key).students.push({
      name: log.studentId?.name,
      grade: log.studentId?.grade,
      subject: log.subject,
      topic: log.topic
    });
  }

  return [...groups.values()];
};

// @desc    Get all volunteers with their attendance stats
// @route   GET /api/volunteer-attendance
// @access  Private (Admin only)
exports.getAllVolunteerAttendance = async (req, res, next) => {
  try {
    const [volunteers, counts] = await Promise.all([
      User.find({ role: 'volunteer' }).select('name email phone').lean(),
      sessionCountsByVolunteer()
    ]);

    const volunteerStats = rankVolunteers(volunteers, counts);

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
    const [logs, volunteers, counts] = await Promise.all([
      TeachingLog.find({ volunteerId: req.user.id })
        .populate('sessionId', 'title startTime endTime')
        .populate('studentId', 'name grade')
        .sort({ timestamp: -1 })
        .lean(),
      User.find({ role: 'volunteer' }).select('_id').lean(),
      sessionCountsByVolunteer()
    ]);

    const attendanceHistory = groupLogsBySession(logs);

    // Rank comes from the same single aggregation, rather than replaying the
    // whole leaderboard with one query per volunteer.
    const ranked = rankVolunteers(volunteers, counts);
    const mine = ranked.find((v) => String(v._id) === String(req.user.id));

    res.status(200).json({
      success: true,
      data: {
        totalSessions: counts.get(String(req.user.id)) || 0,
        rank: mine ? mine.rank : 0,
        totalVolunteers: volunteers.length,
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
    const [volunteer, logs] = await Promise.all([
      User.findById(req.params.volunteerId).select('name email phone').lean(),
      TeachingLog.find({ volunteerId: req.params.volunteerId })
        .populate('sessionId', 'title startTime endTime')
        .populate('studentId', 'name grade')
        .sort({ timestamp: -1 })
        .lean()
    ]);

    if (!volunteer) {
      return res.status(404).json({
        success: false,
        message: 'Volunteer not found'
      });
    }

    const attendanceHistory = groupLogsBySession(logs);

    res.status(200).json({
      success: true,
      data: {
        volunteer: {
          id: volunteer._id,
          name: volunteer.name,
          email: volunteer.email,
          phone: volunteer.phone
        },
        totalSessions: attendanceHistory.length,
        totalStudentsTaught: logs.length,
        attendanceHistory
      }
    });
  } catch (error) {
    next(error);
  }
};
