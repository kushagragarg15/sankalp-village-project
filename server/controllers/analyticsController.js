const Student = require('../models/Student');
const User = require('../models/User');
const TeachingLog = require('../models/TeachingLog');
const AttendanceSession = require('../models/AttendanceSession');

// @desc    Aggregated teaching insights
// @route   GET /api/analytics/overview
// @access  Private (any signed-in member)
//
// The Insights page used to assemble this in the browser from /teaching-logs,
// /users, /attendance-sessions and /students. Two of those are admin-only, so
// for a volunteer the page failed silently and claimed there was no data at
// all — even though Insights sits in the volunteer menu. It also shipped every
// log to the client just to count them. This does the counting in the database
// and returns only totals, so it is safe for everyone to read.
exports.getOverview = async (req, res, next) => {
  try {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const [
      totalLessons,
      totalStudents,
      totalVolunteers,
      totalSessions,
      liveSessions,
      daily,
      subjects,
      volunteers,
      students
    ] = await Promise.all([
      TeachingLog.countDocuments(),
      Student.countDocuments(),
      User.countDocuments({ role: 'volunteer' }),
      AttendanceSession.countDocuments(),
      AttendanceSession.countDocuments({
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() }
      }),

      // Lessons and distinct children per day, for the last 30 days.
      TeachingLog.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
            },
            lessons: { $sum: 1 },
            children: { $addToSet: '$studentId' }
          }
        },
        { $project: { _id: 1, lessons: 1, children: { $size: '$children' } } },
        { $sort: { _id: 1 } }
      ]),

      TeachingLog.aggregate([
        { $group: { _id: '$subject', lessons: { $sum: 1 } } },
        { $sort: { lessons: -1 } },
        { $limit: 8 }
      ]),

      TeachingLog.aggregate([
        { $group: { _id: '$volunteerId', lessons: { $sum: 1 } } },
        { $sort: { lessons: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $project: { name: { $first: '$user.name' }, lessons: 1 } }
      ]),

      TeachingLog.aggregate([
        { $group: { _id: '$studentId', lessons: { $sum: 1 } } },
        { $sort: { lessons: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
        { $project: { name: { $first: '$student.name' }, lessons: 1 } }
      ])
    ]);

    const named = (rows) =>
      rows
        .filter((row) => row.name)
        .map((row) => ({ name: row.name, lessons: row.lessons }));

    res.status(200).json({
      success: true,
      data: {
        totals: {
          lessons: totalLessons,
          students: totalStudents,
          volunteers: totalVolunteers,
          sessions: totalSessions,
          liveSessions
        },
        daily: daily.map((day) => ({
          date: day._id,
          lessons: day.lessons,
          children: day.children
        })),
        subjects: subjects.map((row) => ({ name: row._id, lessons: row.lessons })),
        volunteers: named(volunteers),
        students: named(students)
      }
    });
  } catch (error) {
    next(error);
  }
};
