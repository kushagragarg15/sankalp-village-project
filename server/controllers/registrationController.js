const { eq, and, desc } = require('drizzle-orm');
const { getDb } = require('../db');
const { registrations, attendanceSessions, teachingLogs, users } = require('../db/schema');
const { withId } = require('../db/serialize');

// @desc    Register volunteer for session
// @route   POST /api/registrations/register
// @access  Private
exports.registerForSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const db = getDb();
    const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Registering for a session that has already finished cannot lead
    // anywhere: attendance can only be recorded inside the session window.
    if (new Date() > session.endTime) {
      return res.status(400).json({ success: false, message: 'This session has already closed.' });
    }

    const [existingRegistration] = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.userId, req.user.id), eq(registrations.sessionId, sessionId)))
      .limit(1);

    if (existingRegistration) {
      return res.status(400).json({ success: false, message: 'You are already registered for this session' });
    }

    const [registration] = await db
      .insert(registrations)
      .values({ userId: req.user.id, sessionId })
      .returning();

    res.status(201).json({ success: true, data: withId(registration) });
  } catch (error) {
    // Race between the pre-check and the insert — the unique index is the
    // real guarantee. drizzle-orm wraps the raw `pg` error (which carries the
    // Postgres error code) in `.cause` rather than copying `code` onto itself.
    if ((error.code || error.cause?.code) === '23505') {
      return res.status(400).json({ success: false, message: 'You are already registered for this session' });
    }
    next(error);
  }
};

// @desc    Get user's registrations
// @route   GET /api/registrations/my-registrations
// @access  Private
exports.getMyRegistrations = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ registration: registrations, session: attendanceSessions })
      .from(registrations)
      .leftJoin(attendanceSessions, eq(registrations.sessionId, attendanceSessions.id))
      .where(eq(registrations.userId, req.user.id))
      .orderBy(desc(registrations.createdAt));

    const data = rows.map((r) => ({
      ...withId(r.registration),
      sessionId: r.session ? withId(r.session) : r.registration.sessionId
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registrations for a session
// @route   GET /api/registrations/session/:sessionId
// @access  Private (Admin only)
exports.getSessionRegistrations = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ registration: registrations, userId: users.id, name: users.name, email: users.email })
      .from(registrations)
      .leftJoin(users, eq(registrations.userId, users.id))
      .where(eq(registrations.sessionId, req.params.sessionId))
      .orderBy(desc(registrations.createdAt));

    const data = rows.map((r) => ({
      ...withId(r.registration),
      userId: r.userId ? { _id: r.userId, id: r.userId, name: r.name, email: r.email } : r.registration.userId
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Unregister from session
// @route   DELETE /api/registrations/:id
// @access  Private
exports.unregister = async (req, res, next) => {
  try {
    const db = getDb();
    const [registration] = await db.select().from(registrations).where(eq(registrations.id, req.params.id)).limit(1);

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (String(registration.userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this registration' });
    }

    const [alreadyTaught] = await db
      .select({ id: teachingLogs.id })
      .from(teachingLogs)
      .where(and(eq(teachingLogs.volunteerId, req.user.id), eq(teachingLogs.sessionId, registration.sessionId)))
      .limit(1);

    if (alreadyTaught) {
      return res
        .status(400)
        .json({ success: false, message: 'You have already recorded attendance for this session, so it cannot be withdrawn.' });
    }

    await db.delete(registrations).where(eq(registrations.id, req.params.id));

    res.status(200).json({ success: true, message: 'Unregistered successfully' });
  } catch (error) {
    next(error);
  }
};
