const mongoose = require('mongoose');

// One row per question put to the "Ask Sankalp" agent. Stores the full trace —
// every tool the model chose, with what arguments, how long it took and whether
// it worked — so a run can be audited or replayed after the fact. This is what
// lets an admin answer "why did it say that?" instead of guessing.
const agentRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'volunteer'], required: true },
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'max_iterations', 'error'],
      required: true
    },
    model: { type: String, required: true },
    iterations: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    usage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 }
    },
    steps: [
      {
        _id: false,
        iteration: Number,
        tool: String,
        args: mongoose.Schema.Types.Mixed,
        ok: Boolean,
        durationMs: Number,
        // A short preview only; full results can be large and are re-derivable.
        resultPreview: String,
        error: String
      }
    ],
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

agentRunSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AgentRun', agentRunSchema);
