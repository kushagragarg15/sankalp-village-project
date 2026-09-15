const { eq, desc, sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { teachingLogs, users, attendanceSessions, students } = require('../db/schema');

/**
 * Sessions attended, per volunteer, in ONE round trip — a `GROUP BY` over
 * distinct (volunteer, session) pairs, same shape as the two-stage Mongo
 * aggregation it replaces.
 *
 * Returns a Map of volunteerId -> distinct session count.
 */
const sessionCountsByVolunteer = async (db) => {
  const rows = await db.execute(sql`
    SELECT volunteer_id, COUNT(DISTINCT session_id)::int AS sessions_attended
    FROM ${teachingLogs}
    GROUP BY volunteer_id
  `);
  return new Map(rows.rows.map((row) => [String(row.volunteer_id), row.sessions_attended]));
};

// Ranked highest-first, with volunteers who have taught nothing included at 0.
const rankVolunteers = (volunteers, counts) => {
  const ranked = volunteers.map((volunteer) => ({
    _id: volunteer.id,
    id: volunteer.id,
    name: volunteer.name,
    email: volunteer.email,
    phone: volunteer.phone,
    sessionsAttended: counts.get(String(volunteer.id)) || 0
  }));

  ranked.sort((a, b) => b.sessionsAttended - a.sessionsAttended);
  ranked.forEach((volunteer, index) => {
    volunteer.rank = index + 1;
  });

  return ranked;
};

// Fold a volunteer's logs into one entry per session.
const groupLogsBySession = (rows) => {
  const groups = new Map();

  for (const row of rows) {
    const session = row.session;
    if (!session?.id) continue;

    const key = String(session.id);
    if (!groups.has(key)) {
      groups.set(key, {
        session: { id: session.id, title: session.title, startTime: session.startTime, endTime: session.endTime },
        students: [],
        submittedAt: row.log.loggedAt
      });
    }

    groups.get(key).students.push({
      name: row.student?.name,
      grade: row.student?.grade,
      subject: row.log.subject,
      topic: row.log.topic
    });
  }

  return [...groups.values()];
};

// @desc    Get all volunteers with their attendance stats
// @route   GET /api/volunteer-attendance
// @access  Private (Admin only)
exports.getAllVolunteerAttendance = async (req, res, next) => {
  try {
    const db = getDb();
    const [volunteers, counts] = await Promise.all([
      db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.role, 'volunteer')),
      sessionCountsByVolunteer(db)
    ]);

    const volunteerStats = rankVolunteers(volunteers, counts);

    res.status(200).json({ success: true, count: volunteerStats.length, data: volunteerStats });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my attendance as a volunteer
// @route   GET /api/volunteer-attendance/my-attendance
// @access  Private
exports.getMyAttendance = async (req, res, next) => {
  try {
    const db = getDb();
    const [rows, volunteers, counts] = await Promise.all([
      db
        .select({ log: teachingLogs, session: attendanceSessions, student: students })
        .from(teachingLogs)
        .leftJoin(attendanceSessions, eq(teachingLogs.sessionId, attendanceSessions.id))
        .leftJoin(students, eq(teachingLogs.studentId, students.id))
        .where(eq(teachingLogs.volunteerId, req.user.id))
        .orderBy(desc(teachingLogs.loggedAt)),
      db.select({ id: users.id }).from(users).where(eq(users.role, 'volunteer')),
      sessionCountsByVolunteer(db)
    ]);

    const attendanceHistory = groupLogsBySession(rows);
    const ranked = rankVolunteers(volunteers, counts);
    const mine = ranked.find((v) => String(v.id) === String(req.user.id));

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
    const db = getDb();
    const [[volunteer], rows] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
        .from(users)
        .where(eq(users.id, req.params.volunteerId))
        .limit(1),
      db
        .select({ log: teachingLogs, session: attendanceSessions, student: students })
        .from(teachingLogs)
        .leftJoin(attendanceSessions, eq(teachingLogs.sessionId, attendanceSessions.id))
        .leftJoin(students, eq(teachingLogs.studentId, students.id))
        .where(eq(teachingLogs.volunteerId, req.params.volunteerId))
        .orderBy(desc(teachingLogs.loggedAt))
    ]);

    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }

    const attendanceHistory = groupLogsBySession(rows);

    res.status(200).json({
      success: true,
      data: {
        volunteer: { id: volunteer.id, name: volunteer.name, email: volunteer.email, phone: volunteer.phone },
        totalSessions: attendanceHistory.length,
        totalStudentsTaught: rows.length,
        attendanceHistory
      }
    });
  } catch (error) {
    next(error);
  }
};
