const mongoose = require('mongoose');

// One row per eval run, so a change to the retriever or the prompts can be
// judged against the previous numbers instead of against memory. The eval
// scripts print the last run of the same kind next to the new one.
const evalRunSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['retrieval', 'generation'], required: true },
    // What was being measured: mode, k, threshold, models, golden-set size.
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Aggregates, e.g. { precisionAtK, recallAtK, mrr, hitAt1, falsePositiveRate }.
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    // One entry per golden query, so a regression can be traced to a query.
    perQuery: { type: [mongoose.Schema.Types.Mixed], default: [] },
    durationMs: { type: Number, default: 0 },
    note: { type: String, default: '' }
  },
  { timestamps: true }
);

evalRunSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model('EvalRun', evalRunSchema);
