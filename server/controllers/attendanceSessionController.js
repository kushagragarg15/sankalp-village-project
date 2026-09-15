const { eq, desc, sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { attendanceSessions, users } = require('../db/schema');
const { withId, withIds } = require('../db/serialize');

// How long an issued code stays valid.
const CODE_TTL_MS = 10 * 60 * 1000;

// The code exists to prove a volunteer is physically in the room, so only
// coordinators may read it.
const withoutCode = (session) => {
  const { activeCode, codeExpiry, ...rest } = session;
  return rest;
};

const forViewer = (sessions, user) => (user?.role === 'admin' ? sessions : sessions.map(withoutCode));

// Four digits — see the original reasoning in this file's git history: no
// homographs read aloud across a room, a number pad to type them on. The code
// is not the security boundary; geofence + session window + expiry + the
// registration check are.
const CODE_LENGTH = 4;

const generateRandomCode = () => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += String(Math.floor(Math.random() * 10));
  return code;
};

const withCreatedBy = (row) => ({
  ...withId(row.session),
  createdBy: row.creatorId ? { _id: row.creatorId, id: row.creatorId, name: row.creatorName, email: row.creatorEmail } : row.session.createdBy
});

// @desc    Create new attendance session
// @route   POST /api/attendance-sessions/create
// @access  Private (Admin only)
exports.createSession = async (req, res, next) => {
  try {
    const { title, startTime, endTime, location } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Title, start time, and end time are required' });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const db = getDb();
    const [session] = await db
      .insert(attendanceSessions)
      .values({
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
        createdBy: req.user.id
      })
      .returning();

    res.status(201).json({ success: true, data: withId(session) });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate attendance code for session
// @route   POST /api/attendance-sessions/:id/generate-code
// @access  Private (Admin only)
exports.generateCode = async (req, res, next) => {
  try {
    const db = getDb();
    const code = generateRandomCode();
    const expiry = new Date(Date.now() + CODE_TTL_MS);

    const [session] = await db
      .update(attendanceSessions)
      .set({ activeCode: code, codeExpiry: expiry })
      .where(eq(attendanceSessions.id, req.params.id))
      .returning({ id: attendanceSessions.id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.status(200).json({ success: true, data: { code, expiry } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sessions
// @route   GET /api/attendance-sessions
// @access  Private
exports.getAllSessions = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        session: attendanceSessions,
        creatorId: users.id,
        creatorName: users.name,
        creatorEmail: users.email
      })
      .from(attendanceSessions)
      .leftJoin(users, eq(attendanceSessions.createdBy, users.id))
      .orderBy(desc(attendanceSessions.startTime));

    const now = new Date();
    const isCurrentFormat = (code) => /^\d{4}$/.test(code || '');

    const stale = rows.filter(({ session }) => {
      const isActive = now >= session.startTime && now <= session.endTime;
      const hasValidCode =
        session.activeCode && isCurrentFormat(session.activeCode) && session.codeExpiry && now < session.codeExpiry;
      return isActive && !hasValidCode;
    });

    if (stale.length > 0) {
      const expiry = new Date(Date.now() + CODE_TTL_MS);
      const updates = stale.map(({ session }) => {
        const code = generateRandomCode();
        session.activeCode = code;
        session.codeExpiry = expiry;
        return { id: session.id, code };
      });

      // One statement for the whole rotation, same as the original bulkWrite —
      // sessions that already hold a valid code cost nothing at all.
      const rowsSql = sql.join(
        updates.map((u) => sql`(${u.id}::uuid, ${u.code}::text)`),
        sql`, `
      );
      await db.execute(
        sql`UPDATE ${attendanceSessions} AS a SET active_code = v.code, code_expiry = ${expiry}
            FROM (VALUES ${rowsSql}) AS v(id, code) WHERE a.id = v.id`
      );
    }

    const sessions = forViewer(rows.map(withCreatedBy), req.user);
    res.status(200).json({ success: true, count: sessions.length, data: sessions });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single session
// @route   GET /api/attendance-sessions/:id
// @access  Private
exports.getSession = async (req, res, next) => {
  try {
    const db = getDb();
    const [row] = await db
      .select({ session: attendanceSessions, creatorId: users.id, creatorName: users.name, creatorEmail: users.email })
      .from(attendanceSessions)
      .leftJoin(users, eq(attendanceSessions.createdBy, users.id))
      .where(eq(attendanceSessions.id, req.params.id))
      .limit(1);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const session = withCreatedBy(row);
    res.status(200).json({ success: true, data: req.user?.role === 'admin' ? session : withoutCode(session) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete session
// @route   DELETE /api/attendance-sessions/:id
// @access  Private (Admin only)
exports.deleteSession = async (req, res, next) => {
  try {
    const db = getDb();
    const [session] = await db
      .delete(attendanceSessions)
      .where(eq(attendanceSessions.id, req.params.id))
      .returning({ id: attendanceSessions.id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.status(200).json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    next(error);
  }
};
