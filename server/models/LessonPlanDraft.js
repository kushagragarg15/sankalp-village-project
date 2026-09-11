const mongoose = require('mongoose');

/**
 * A session-prep plan the workflow drafted for one volunteer, for one session.
 *
 * Nothing here is "real" until a person says so: a draft is a proposal, and the
 * volunteer either approves it (possibly after editing), or rejects it with a
 * reason. Re-running the workflow supersedes the previous draft rather than
 * overwriting it, so the history of what the model suggested and what the
 * volunteer changed is kept.
 */
const focusGroupSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true },
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    // Why the planner chose this group — shown to the volunteer so they can
    // disagree with the reasoning, not just the output.
    rationale: { type: String, default: '' },
    students: [
      {
        _id: false,
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
        name: String
      }
    ],
    objective: { type: String, default: '' },
    activity: { type: String, default: '' },
    checkQuestions: { type: [String], default: [] },
    // RAG provenance for this block.
    sources: [{ _id: false, label: String, similarity: Number }]
  },
  { _id: false }
);

const lessonPlanDraftSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'superseded'],
      default: 'draft'
    },
    focusGroups: { type: [focusGroupSchema], default: [] },

    // Human-in-the-loop record.
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    editedByVolunteer: { type: Boolean, default: false },

    // What the workflow saw and did, for audit and for the UI's trace.
    contextSummary: {
      studentsTaughtByVolunteer: { type: Number, default: 0 },
      studentsFlagged: { type: Number, default: 0 },
      lessonsByVolunteer: { type: Number, default: 0 }
    },
    trace: [{ _id: false, step: String, durationMs: Number, detail: String }],
    usage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 }
    },
    generatedBy: { provider: String, model: String },
    durationMs: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// "The current draft for this volunteer and session" is the hot query.
lessonPlanDraftSchema.index({ sessionId: 1, volunteerId: 1, status: 1 });
lessonPlanDraftSchema.index({ volunteerId: 1, createdAt: -1 });

module.exports = mongoose.model('LessonPlanDraft', lessonPlanDraftSchema);
