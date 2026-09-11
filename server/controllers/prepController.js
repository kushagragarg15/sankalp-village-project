const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');
const User = require('../models/User');
const LessonPlanDraft = require('../models/LessonPlanDraft');
const { prepareSession } = require('../services/sessionPrepService');
const { isConfigured, notConfiguredMessage } = require('../services/llmClient');

/**
 * Session prep: the workflow drafts, a person decides.
 *
 * Volunteers can only prepare for sessions they are registered for and that
 * have not ended; they can only see and review their own drafts. Coordinators
 * can prepare every registered volunteer for a session at once and see the
 * review status of all drafts — but they cannot approve on a volunteer's
 * behalf. The person walking into the classroom is the one who signs off.
 */

const populateDraft = (query) =>
  query
    .populate('sessionId', 'title startTime endTime')
    .populate('volunteerId', 'name');

// A session a volunteer may prepare for: exists, not over, and they are on the list.
async function loadPreparableSession(sessionId, user) {
  const session = await AttendanceSession.findById(sessionId).lean();
  if (!session) return { error: { status: 404, message: 'Session not found' } };
  if (new Date(session.endTime) < new Date()) {
    return { error: { status: 400, message: 'That session has already ended.' } };
  }
  if (user.role !== 'admin') {
    const registered = await Registration.exists({ sessionId: session._id, userId: user._id });
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
    const { session, error } = await loadPreparableSession(req.params.sessionId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { draft, created } = await prepareSession({
      session,
      volunteer: req.user,
      force: Boolean(req.body?.force)
    });
    const full = await populateDraft(LessonPlanDraft.findById(draft._id));
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
    const draft = await populateDraft(
      LessonPlanDraft.findOne({
        sessionId: req.params.sessionId,
        volunteerId: req.user._id,
        status: { $in: ['draft', 'approved', 'rejected'] }
      }).sort({ createdAt: -1 })
    );
    res.status(200).json({ success: true, data: draft });
  } catch (error) {
    next(error);
  }
};

// @desc    All my plans, newest first
// @route   GET /api/prep/mine
// @access  Private
exports.getMyPlans = async (req, res, next) => {
  try {
    const drafts = await populateDraft(
      LessonPlanDraft.find({ volunteerId: req.user._id, status: { $ne: 'superseded' } })
        .sort({ createdAt: -1 })
        .limit(20)
    );
    res.status(200).json({ success: true, count: drafts.length, data: drafts });
  } catch (error) {
    next(error);
  }
};

// Owner-only, and only while it is still a draft.
async function loadEditableDraft(id, user) {
  const draft = await LessonPlanDraft.findById(id);
  if (!draft) return { error: { status: 404, message: 'Plan not found' } };
  if (String(draft.volunteerId) !== String(user._id)) {
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
    const { draft, error } = await loadEditableDraft(req.params.id, req.user);
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
    draft.focusGroups.forEach((group, i) => {
      const e = edits[i] || {};
      const topic = clip(e.topic, 120);
      const objective = clip(e.objective, 600);
      const activity = clip(e.activity, 3000);
      if (topic) group.topic = topic;
      if (objective !== undefined) group.objective = objective;
      if (activity !== undefined) group.activity = activity;
      if (Array.isArray(e.checkQuestions)) {
        group.checkQuestions = e.checkQuestions
          .map((q) => clip(q, 400))
          .filter(Boolean)
          .slice(0, 6);
      }
    });
    draft.editedByVolunteer = true;
    await draft.save();

    res.status(200).json({ success: true, data: await populateDraft(LessonPlanDraft.findById(draft._id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a draft — this is the plan I will teach
// @route   POST /api/prep/:id/approve   body: { note? }
// @access  Private (owner)
exports.approveDraft = async (req, res, next) => {
  try {
    const { draft, error } = await loadEditableDraft(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    draft.status = 'approved';
    draft.reviewNote = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : '';
    draft.reviewedAt = new Date();
    await draft.save();

    res.status(200).json({ success: true, data: await populateDraft(LessonPlanDraft.findById(draft._id)) });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a draft, with a reason (kept so the planner can be improved)
// @route   POST /api/prep/:id/reject   body: { reason }
// @access  Private (owner)
exports.rejectDraft = async (req, res, next) => {
  try {
    const { draft, error } = await loadEditableDraft(req.params.id, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Say briefly why, so the next draft can be better.' });
    }

    draft.status = 'rejected';
    draft.reviewNote = reason.slice(0, 500);
    draft.reviewedAt = new Date();
    await draft.save();

    res.status(200).json({ success: true, data: await populateDraft(LessonPlanDraft.findById(draft._id)) });
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
    const { session, error } = await loadPreparableSession(req.params.sessionId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const registrations = await Registration.find({ sessionId: session._id }).select('userId').lean();
    const volunteers = await User.find({ _id: { $in: registrations.map((r) => r.userId) } })
      .select('name email role')
      .lean();

    // Sequential on purpose: each prep is 2 model calls, and free-tier
    // providers throttle per minute. Parallel would just trade speed for 429s.
    const results = [];
    for (const volunteer of volunteers) {
      try {
        const { draft, created } = await prepareSession({ session, volunteer });
        results.push({ volunteer: volunteer.name, status: created ? 'drafted' : 'already had one', draftId: draft._id });
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
    const drafts = await populateDraft(
      LessonPlanDraft.find({ sessionId: req.params.sessionId, status: { $ne: 'superseded' } }).sort({ createdAt: -1 })
    );
    res.status(200).json({ success: true, count: drafts.length, data: drafts });
  } catch (error) {
    next(error);
  }
};
