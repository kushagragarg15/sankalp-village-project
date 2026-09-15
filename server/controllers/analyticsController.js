const { sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { teachingLogs, students, users, attendanceSessions } = require('../db/schema');

// @desc    Aggregated teaching insights
// @route   GET /api/analytics/overview
// @access  Private (any signed-in member)
//
// Computed in the database, returns only totals — safe for any signed-in
// member to read (the raw logs are admin-only elsewhere).
exports.getOverview = async (req, res, next) => {
  try {
    const db = getDb();
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const [
      [{ count: totalLessons }],
      [{ count: totalStudents }],
      [{ count: totalVolunteers }],
      [{ count: totalSessions }],
      [{ count: liveSessions }],
      dailyResult,
      subjectsResult,
      volunteersResult,
      studentsResult
    ] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM ${teachingLogs}`).then((r) => r.rows),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM ${students}`).then((r) => r.rows),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM ${users} WHERE role = 'volunteer'`).then((r) => r.rows),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM ${attendanceSessions}`).then((r) => r.rows),
      db
        .execute(sql`SELECT COUNT(*)::int AS count FROM ${attendanceSessions} WHERE start_time <= now() AND end_time >= now()`)
        .then((r) => r.rows),

      // Lessons and distinct children per day (UTC calendar day), last 30 days.
      db.execute(sql`
        SELECT to_char(logged_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS lessons,
               COUNT(DISTINCT student_id)::int AS children
        FROM ${teachingLogs}
        WHERE logged_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `),

      db.execute(sql`
        SELECT subject AS name, COUNT(*)::int AS lessons
        FROM ${teachingLogs}
        GROUP BY subject
        ORDER BY lessons DESC
        LIMIT 8
      `),

      db.execute(sql`
        SELECT u.name AS name, COUNT(*)::int AS lessons
        FROM ${teachingLogs} tl
        JOIN ${users} u ON u.id = tl.volunteer_id
        GROUP BY u.name
        ORDER BY lessons DESC
        LIMIT 8
      `),

      db.execute(sql`
        SELECT s.name AS name, COUNT(*)::int AS lessons
        FROM ${teachingLogs} tl
        JOIN ${students} s ON s.id = tl.student_id
        GROUP BY s.name
        ORDER BY lessons DESC
        LIMIT 8
      `)
    ]);

    const named = (rows) => rows.filter((row) => row.name).map((row) => ({ name: row.name, lessons: row.lessons }));

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
        daily: dailyResult.rows.map((day) => ({ date: day.date, lessons: day.lessons, children: day.children })),
        subjects: subjectsResult.rows.map((row) => ({ name: row.name, lessons: row.lessons })),
        volunteers: named(volunteersResult.rows),
        students: named(studentsResult.rows)
      }
    });
  } catch (error) {
    next(error);
  }
};
