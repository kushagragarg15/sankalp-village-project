const { eq, and, desc, sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { teachingLogs, attendanceSessions, registrations, students, users } = require('../db/schema');
const { withId } = require('../db/serialize');

// Where attendance may be recorded, when a session carries no location of its
// own. Overridable so the club can move sites without a code change.
const DEFAULT_SCHOOL_LAT = Number(process.env.SCHOOL_LAT || 26.933531637176955);
const DEFAULT_SCHOOL_LNG = Number(process.env.SCHOOL_LNG || 75.9162266441557);
const ALLOWED_RADIUS_M = Number(process.env.ATTENDANCE_RADIUS_M || 1000);

// Haversine formula to calculate distance between two coordinates (in meters)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// @desc    Submit teaching log
// @route   POST /api/teaching-logs/submit
// @access  Private
exports.submitTeachingLog = async (req, res, next) => {
  try {
    const { session_id, entries, code, lat, lng } = req.body;

    if (!session_id || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'Session ID and at least one entry are required' });
    }

    if (!code) {
      return res.status(400).json({ success: false, message: 'Attendance code is required' });
    }

    for (const entry of entries) {
      if (!entry.student_id || !entry.subject || !entry.topic) {
        return res.status(400).json({ success: false, message: 'Each entry must have student_id, subject, and topic' });
      }
    }

    const db = getDb();

    // 1 + 3. The session and the volunteer's registration do not depend on
    // each other, so fetch them in parallel.
    const [[session], [registration]] = await Promise.all([
      db.select().from(attendanceSessions).where(eq(attendanceSessions.id, session_id)).limit(1),
      db
        .select({ id: registrations.id })
        .from(registrations)
        .where(and(eq(registrations.userId, req.user.id), eq(registrations.sessionId, session_id)))
        .limit(1)
    ]);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // 2. Validate session is active (current time between startTime and endTime)
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      return res.status(400).json({ success: false, message: 'Session is not currently active' });
    }

    if (!registration) {
      return res.status(403).json({ success: false, message: 'You are not registered for this session' });
    }

    // 4. Validate code
    if (!session.activeCode || session.activeCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid attendance code' });
    }

    if (!session.codeExpiry || now > session.codeExpiry) {
      return res.status(400).json({ success: false, message: 'Attendance code has expired' });
    }

    // 5. Validate location — a client that omits coordinates is refused, not
    // silently let through with no geofence check.
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Location is required to record attendance. Enable location access and try again.'
      });
    }

    const origin = {
      lat: typeof session.lat === 'number' ? session.lat : DEFAULT_SCHOOL_LAT,
      lng: typeof session.lng === 'number' ? session.lng : DEFAULT_SCHOOL_LNG
    };

    const distance = calculateDistance(origin.lat, origin.lng, lat, lng);

    if (distance > ALLOWED_RADIUS_M) {
      return res.status(400).json({
        success: false,
        message: `You need to be at the school to record attendance. You are about ${Math.round(distance)}m away.`
      });
    }

    // 6. Insert every entry in one atomic statement. The unique index on
    // (session_id, volunteer_id, student_id) is what actually enforces no
    // double-logging — ON CONFLICT DO NOTHING lets Postgres skip duplicates
    // in the same round trip instead of parsing write errors back out of a
    // bulk-insert response the way the Mongo version had to.
    const rows = sql.join(
      entries.map(
        (entry) =>
          sql`(${req.user.id}::uuid, ${session_id}::uuid, ${entry.student_id}::uuid, ${entry.subject}::text, ${entry.topic}::text, ${code}::text, ${lat}::double precision, ${lng}::double precision)`
      ),
      sql`, `
    );

    const inserted = await db.execute(
      sql`INSERT INTO ${teachingLogs} (volunteer_id, session_id, student_id, subject, topic, code_used, lat, lng)
          VALUES ${rows}
          ON CONFLICT (session_id, volunteer_id, student_id) DO NOTHING
          RETURNING *`
    );

    const createdLogs = inserted.rows;
    const duplicates = entries.length - createdLogs.length;

    res.status(201).json({
      success: true,
      message: `Successfully logged ${createdLogs.length} teaching entries`,
      data: {
        created: createdLogs.length,
        duplicates,
        logs: createdLogs.map((l) => withId({
          id: l.id,
          volunteerId: l.volunteer_id,
          sessionId: l.session_id,
          studentId: l.student_id,
          subject: l.subject,
          topic: l.topic,
          timestamp: l.logged_at,
          codeUsed: l.code_used,
          lat: l.lat,
          lng: l.lng,
          createdAt: l.created_at,
          updatedAt: l.updated_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const logWithRefs = (row) => ({
  ...withId(row.log),
  timestamp: row.log.loggedAt,
  sessionId: row.session ? withId(row.session) : row.log.sessionId,
  studentId: row.student ? withId(row.student) : row.log.studentId,
  volunteerId: row.volunteer ? { _id: row.volunteer.id, id: row.volunteer.id, name: row.volunteer.name, email: row.volunteer.email } : row.log.volunteerId
});

// @desc    Get teaching logs for a volunteer
// @route   GET /api/teaching-logs/my-logs
// @access  Private
exports.getMyLogs = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ log: teachingLogs, session: attendanceSessions, student: students })
      .from(teachingLogs)
      .leftJoin(attendanceSessions, eq(teachingLogs.sessionId, attendanceSessions.id))
      .leftJoin(students, eq(teachingLogs.studentId, students.id))
      .where(eq(teachingLogs.volunteerId, req.user.id))
      .orderBy(desc(teachingLogs.loggedAt));

    const data = rows.map(logWithRefs);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teaching logs for a session
// @route   GET /api/teaching-logs/session/:sessionId
// @access  Private (Admin only)
exports.getSessionLogs = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ log: teachingLogs, volunteer: users, student: students })
      .from(teachingLogs)
      .leftJoin(users, eq(teachingLogs.volunteerId, users.id))
      .leftJoin(students, eq(teachingLogs.studentId, students.id))
      .where(eq(teachingLogs.sessionId, req.params.sessionId))
      .orderBy(desc(teachingLogs.loggedAt));

    const data = rows.map(logWithRefs);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all teaching logs (Admin)
// @route   GET /api/teaching-logs
// @access  Private (Admin only)
exports.getAllLogs = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ log: teachingLogs, volunteer: users, session: attendanceSessions, student: students })
      .from(teachingLogs)
      .leftJoin(users, eq(teachingLogs.volunteerId, users.id))
      .leftJoin(attendanceSessions, eq(teachingLogs.sessionId, attendanceSessions.id))
      .leftJoin(students, eq(teachingLogs.studentId, students.id))
      .orderBy(desc(teachingLogs.loggedAt))
      .limit(100);

    const data = rows.map(logWithRefs);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};
