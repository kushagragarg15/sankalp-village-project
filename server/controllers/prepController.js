const { eq, and, ne, desc, inArray } = require('drizzle-orm');
const { getDb } = require('../db');
const { attendanceSessions, registrations, users, lessonPlanDrafts } = require('../db/schema');
const { withId } = require('../db/serialize');
const { prepareSession } = require('../services/sessionPrepService');
const { isConfigured, notConfiguredMessage } = require('../services/llmClient');
const { invalidateBudget } = require('../middleware/aiBudget');

/**
 * Session prep: the workflow drafts, a person decides.
 *
 * Volunteers can only prepare for sessions they are registered for and that
 * have not ended; they can only see and review their own drafts. Coordinators
 * can prepare every registered volunteer for a session at once and see the
 * review status of all drafts — but they cannot approve on a volunteer's
 * behalf. The person walking into the classroom is the one who signs off.
 */

async function populateDraft(db, draft) {
  if (!draft) return draft;
  const [[session], [volunteer]] = await Promise.all([
    db
      .select({ id: attendanceSessions.id, title: attendanceSessions.title, startTime: attendanceSessions.startTime, endTime: attendanceSessions.endTime })
      .from(attendanceSessions)
      .where(eq(attendanceSessions.id, draft.sessionId))
      .limit(1),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, draft.volunteerId)).limit(1)
  ]);
  return {
    ...withId(draft),
    sessionId: session ? withId(session) : draft.sessionId,
    volunteerId: volunteer ? { _id: volunteer.id, id: volunteer.id, name: volunteer.name } : draft.volunteerId
  };
}

async function populateDrafts(db, drafts) {
  const sessionIds = [...new Set(drafts.map((d) => d.sessionId))];
  const volunteerIds = [...new Set(drafts.map((d) => d.volunteerId))];
  const [sessionRows, volunteerRows] = await Promise.all([
    sessionIds.length
      ? db
          .select({ id: attendanceSessions.id, title: attendanceSessions.title, startTime: attendanceSessions.startTime, endTime: attendanceSessions.endTime })
          .from(attendanceSessions)
          .where(inArray(attendanceSessions.id, sessionIds))
      : [],
    volunteerIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, volunteerIds)) : []
  ]);
  const sessionById = new Map(sessionRows.map((s) => [s.id, s]));
  const volunteerById = new Map(volunteerRows.map((v) => [v.id, v]));
  return drafts.map((draft) => {
    const session = sessionById.get(draft.sessionId);
    const volunteer = volunteerById.get(draft.volunteerId);
    return {
      ...withId(draft),
      sessionId: session ? withId(session) : draft.sessionId,
      volunteerId: volunteer ? { _id: volunteer.id, id: volunteer.id, name: volunteer.name } : draft.volunteerId
    };
  });
}

// A session a volunteer may prepare for: exists, not over, and they are on the list.
async function loadPreparableSession(db, sessionId, user) {
  const [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);
  if (!session) return { error: { status: 404, message: 'Session not found' } };
  if (new Date(session.endTime) < new Date()) {
    return { error: { status: 400, message: 'That session has already ended.' } };
  }
  if (user.role !== 'admin') {
    const [registered] = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(and(eq(registrations.sessionId, session.id), eq(registrations.userId, user.id)))
      .limit(1);
    if (!registered) {
      return { error: { status: 403, message: 'Register for the session before preparing for it.' } };
    }
  }
  return { session };
}

// @desc    Draft (or fetch the existing) prep plan for me and this session
// @route   POST /api/prep/sessions/:sessionId   body: { force?: boolean }
// @access  Private
exports.prepareForSession = async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }
    const db = getDb();
    const { session, error } = await loadPreparableSession(db, req.params.sessionId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { draft, created } = await prepareSession({
      session,
      volunteer: req.user,
      force: Boolean(req.body?.force)
    });
    if (created) invalidateBudget(req.user.id);
    const full = await populateDraft(db, draft);
    res.status(created ? 201 : 200).json({ success: true, data: full });
  } catch (error) {
    if (error.status === 422) {
      return res.status(422).json({ success: false, message: error.message });
    }
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'The AI provider is rate-limiting us right now. Try again in a minute.'
      });
    }
    next(error);
  }
};

// @desc    My current draft/approved plan for a session (null if none)
// @route   GET /api/prep/sessions/:sessionId
// @access  Private
exports.getMyPlanForSession = async (req, res, next) => {
  try {
    const db = getDb();
    const [draft] = await db
      .select()
      .from(lessonPlanDrafts)
      .where(
        and(
          eq(lessonPlanDrafts.sessionId, req.params.sessionId),
          eq(lessonPlanDrafts.volunteerId, req.user.id),
          inArray(lessonPlanDrafts.status, ['draft', 'approved', 'rejected'])
        )
      )
      .orderBy(desc(lessonPlanDrafts.createdAt))
      .limit(1);

    res.status(200).json({ success: true, data: draft ? await populateDraft(db, draft) : null });
  } catch (error) {
    next(error);
  }
};

// @desc    All my plans, newest first
// @route   GET /api/prep/mine
// @access  Private
exports.getMyPlans = async (req, res, next) => {
  try {
    const db = getDb();
    const drafts = await db
      .select()
      .from(lessonPlanDrafts)
      .where(and(eq(lessonPlanDrafts.volunteerId, req.user.id), ne(lessonPlanDrafts.status, 'superseded')))
      .orderBy(desc(lessonPlanDrafts.createdAt))
      .limit(20);

    const data = drafts.length ? await populateDrafts(db, drafts) : [];
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// Owner-only, and only while it is still a draft.
async function loadEditableDraft(db, id, user) {
  const [draft] = await db.select().from(lessonPlanDrafts).where(eq(lessonPlanDrafts.id, id)).limit(1);
  if (!draft) return { error: { status: 404, message: 'Plan not found' } };
  if (String(draft.volunteerId) !== String(user.id)) {
    return { error: { status: 403, message: 'Only the volunteer this plan is for can change it.' } };
  }
  if (draft.status !== 'draft') {
    return { error: { status: 409, message: `This plan is already ${draft.status}.` } };
  }
  return { draft };
}

// @desc    Edit the text of a draft before approving it
// @route   PATCH /api/prep/:id   body: { focusGroups: [{ topic?, objective?, activity?, checkQuestions? }] }
// @access  Private (owner)
exports.editDraft = async (req, res, next) => {
  try {
    const db = getDb();
    const { draft, error } = await loadEditableDraft(db, req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const edits = Array.isArray(req.body?.focusGroups) ? req.body.focusGroups : null;
    if (!edits || edits.length !== draft.focusGroups.length) {
      return res.status(400).json({
        success: false,
        message: 'focusGroups must be an array with one entry per existing group'
      });
    }

    // Only the human-editable text fields; students, sources and rationale
    // stay as the workflow produced them so the audit trail stays honest.
    const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : undefined);
    const focusGroups = draft.focusGroups.map((group, i) => {
      const e = edits[i] || {};
      const topic = clip(e.topic, 120);
      const objective = clip(e.objective, 600);
      const activity = clip(e.activity, 3000);
      const next = { ...group };
      if (topic) next.topic = topic;
      if (objective !== undefined) next.objective = objective;
      if (activity !== undefined) next.activity = activity;
      if (Array.isArray(e.checkQuestions)) {
        next.checkQuestions = e.checkQuestions.map((q) => clip(q, 400)).filter(Boolean).slice(0, 6);
      }
      return next;
    });

    const [updated] = await db
      .update(lessonPlanDrafts)
      .set({ focusGroups, editedByVolunteer: true })
      .where(eq(lessonPlanDrafts.id, draft.id))
      .returning();

    res.status(200).json({ success: true, data: await populateDraft(db, updated) });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a draft — this is the plan I will teach
// @route   POST /api/prep/:id/approve   body: { note? }
// @access  Private (owner)
exports.approveDraft = async (req, res, next) => {
  try {
    const db = getDb();
    const { draft, error } = await loadEditableDraft(db, req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const [updated] = await db
      .update(lessonPlanDrafts)
      .set({
        status: 'approved',
        reviewNote: typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '',
        reviewedAt: new Date()
      })
      .where(eq(lessonPlanDrafts.id, draft.id))
      .returning();

    res.status(200).json({ success: true, data: await populateDraft(db, updated) });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a draft, with a reason (kept so the planner can be improved)
// @route   POST /api/prep/:id/reject   body: { reason }
// @access  Private (owner)
exports.rejectDraft = async (req, res, next) => {
  try {
    const db = getDb();
    const { draft, error } = await loadEditableDraft(db, req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Say briefly why, so the next draft can be better.' });
    }

    const [updated] = await db
      .update(lessonPlanDrafts)
      .set({ status: 'rejected', reviewNote: reason.slice(0, 500), reviewedAt: new Date() })
      .where(eq(lessonPlanDrafts.id, draft.id))
      .returning();

    res.status(200).json({ success: true, data: await populateDraft(db, updated) });
  } catch (error) {
    next(error);
  }
};

// @desc    Draft plans for every registered volunteer of a session (skips those who already have one)
// @route   POST /api/prep/sessions/:sessionId/all
// @access  Private (admin)
exports.prepareAllForSession = async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }
    const db = getDb();
    const { session, error } = await loadPreparableSession(db, req.params.sessionId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const regs = await db.select({ userId: registrations.userId }).from(registrations).where(eq(registrations.sessionId, session.id));
    const volunteers = regs.length
      ? await db
          .select({ id: users.id, name: users.name, email: users.email, role: users.role })
          .from(users)
          .where(inArray(users.id, regs.map((r) => r.userId)))
      : [];

    // Sequential on purpose: each prep is 2 model calls, and free-tier
    // providers throttle per minute. Parallel would just trade speed for 429s.
    const results = [];
    for (const volunteer of volunteers) {
      try {
        const { draft, created } = await prepareSession({ session, volunteer });
        results.push({ volunteer: volunteer.name, status: created ? 'drafted' : 'already had one', draftId: draft.id });
      } catch (err) {
        results.push({ volunteer: volunteer.name, status: 'failed', error: err.message });
      }
    }

    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (error) {
    next(error);
  }
};

// @desc    Review status of every plan for a session
// @route   GET /api/prep/sessions/:sessionId/all
// @access  Private (admin)
exports.getAllForSession = async (req, res, next) => {
  try {
    const db = getDb();
    const drafts = await db
      .select()
      .from(lessonPlanDrafts)
      .where(and(eq(lessonPlanDrafts.sessionId, req.params.sessionId), ne(lessonPlanDrafts.status, 'superseded')))
      .orderBy(desc(lessonPlanDrafts.createdAt));

    const data = drafts.length ? await populateDrafts(db, drafts) : [];
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};
