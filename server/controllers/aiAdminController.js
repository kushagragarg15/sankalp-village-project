const AgentRun = require('../models/AgentRun');
const LessonPlanDraft = require('../models/LessonPlanDraft');
const EvalRun = require('../models/EvalRun');
const { CHAT_PROVIDER, CHAT_MODEL, EMBEDDING_PROVIDER, EMBEDDING_MODEL } = require('../services/llmClient');
const { RETRIEVAL_MODE } = require('../services/ragService');
const { DAILY_TOKEN_BUDGET, RATE_LIMIT, RATE_WINDOW_MS } = require('../middleware/aiBudget');

/**
 * Coordinator's view of everything the AI features did: what the agent was
 * asked and what it looked up, how volunteers judged the drafted plans (and
 * why they rejected them), and how the evals are trending. All of it comes
 * from the audit rows the features already write — nothing here is sampled
 * or estimated.
 */

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

// @desc    Aggregated AI activity: agent runs, prep reviews, evals, budget config
// @route   GET /api/ai/admin/activity
// @access  Private (admin)
exports.getActivity = async (req, res, next) => {
  try {
    const since7 = daysAgo(7);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const [agentTotals, agentByStatus, agentToolUse, agentByUser, recentRuns, prepByStatus, rejections, prepTotals, evalRetrieval, evalGeneration] =
      await Promise.all([
        // Last 7 days, one row.
        AgentRun.aggregate([
          { $match: { createdAt: { $gte: since7 } } },
          {
            $group: {
              _id: null,
              runs: { $sum: 1 },
              today: { $sum: { $cond: [{ $gte: ['$createdAt', midnight] }, 1, 0] } },
              promptTokens: { $sum: '$usage.promptTokens' },
              completionTokens: { $sum: '$usage.completionTokens' },
              avgDurationMs: { $avg: '$durationMs' },
              avgLlmMs: { $avg: '$llmMs' },
              avgIterations: { $avg: '$iterations' },
              avgSteps: { $avg: { $size: { $ifNull: ['$steps', []] } } }
            }
          }
        ]),
        AgentRun.aggregate([
          { $match: { createdAt: { $gte: since7 } } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        // Which tools the model reaches for, and how often they fail.
        AgentRun.aggregate([
          { $match: { createdAt: { $gte: since7 } } },
          { $unwind: '$steps' },
          {
            $group: {
              _id: '$steps.tool',
              calls: { $sum: 1 },
              failures: { $sum: { $cond: ['$steps.ok', 0, 1] } },
              avgMs: { $avg: '$steps.durationMs' }
            }
          },
          { $sort: { calls: -1 } }
        ]),
        // Per-user spend today, against the budget.
        AgentRun.aggregate([
          { $match: { createdAt: { $gte: midnight } } },
          {
            $group: {
              _id: '$userId',
              runs: { $sum: 1 },
              tokens: { $sum: { $add: ['$usage.promptTokens', '$usage.completionTokens'] } }
            }
          },
          { $sort: { tokens: -1 } },
          { $limit: 10 },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $project: { name: { $first: '$user.name' }, role: { $first: '$user.role' }, runs: 1, tokens: 1 } }
        ]),
        AgentRun.find()
          .sort({ createdAt: -1 })
          .limit(40)
          .select('userId role question answer status model iterations durationMs llmMs usage steps.tool steps.ok steps.durationMs createdAt')
          .populate('userId', 'name')
          .lean(),

        LessonPlanDraft.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        LessonPlanDraft.find({ status: 'rejected' })
          .sort({ reviewedAt: -1 })
          .limit(15)
          .select('reviewNote reviewedAt volunteerId sessionId focusGroups.topic focusGroups.subject')
          .populate('volunteerId', 'name')
          .populate('sessionId', 'title')
          .lean(),
        LessonPlanDraft.aggregate([
          { $match: { status: { $in: ['approved', 'rejected'] } } },
          {
            $group: {
              _id: null,
              reviewed: { $sum: 1 },
              approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
              edited: { $sum: { $cond: ['$editedByVolunteer', 1, 0] } },
              avgTokens: { $avg: { $add: ['$usage.promptTokens', '$usage.completionTokens'] } },
              avgDurationMs: { $avg: '$durationMs' }
            }
          }
        ]),

        EvalRun.find({ kind: 'retrieval' })
          .sort({ createdAt: -1 })
          .limit(12)
          .select('config metrics.recallAtK metrics.precisionAtK metrics.mrr metrics.hitAt1 metrics.falsePositiveRate metrics.misses metrics.falsePositives createdAt')
          .lean(),
        EvalRun.find({ kind: 'generation' })
          .sort({ createdAt: -1 })
          .limit(8)
          .select('config metrics createdAt')
          .lean()
      ]);

    const byStatus = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const a = agentTotals[0] || {};

    res.status(200).json({
      success: true,
      data: {
        config: {
          chat: `${CHAT_PROVIDER}/${CHAT_MODEL}`,
          embeddings: `${EMBEDDING_PROVIDER}/${EMBEDDING_MODEL}`,
          retrievalMode: RETRIEVAL_MODE,
          dailyTokenBudgetPerUser: DAILY_TOKEN_BUDGET,
          rateLimit: { requests: RATE_LIMIT, windowMinutes: RATE_WINDOW_MS / 60000 }
        },
        agent: {
          last7Days: {
            runs: a.runs || 0,
            today: a.today || 0,
            tokens: (a.promptTokens || 0) + (a.completionTokens || 0),
            avgDurationMs: Math.round(a.avgDurationMs || 0),
            avgLlmMs: Math.round(a.avgLlmMs || 0),
            avgIterations: Number((a.avgIterations || 0).toFixed(1)),
            avgSteps: Number((a.avgSteps || 0).toFixed(1)),
            byStatus: byStatus(agentByStatus)
          },
          tools: agentToolUse.map((t) => ({ tool: t._id, calls: t.calls, failures: t.failures, avgMs: Math.round(t.avgMs || 0) })),
          spendToday: agentByUser.map((u) => ({ name: u.name || 'unknown', role: u.role, runs: u.runs, tokens: u.tokens })),
          recent: recentRuns.map((r) => ({
            id: r._id,
            user: r.userId?.name || 'unknown',
            role: r.role,
            question: r.question,
            answerPreview: (r.answer || '').slice(0, 160),
            status: r.status,
            model: r.model,
            iterations: r.iterations,
            durationMs: r.durationMs,
            llmMs: r.llmMs,
            tokens: (r.usage?.promptTokens || 0) + (r.usage?.completionTokens || 0),
            tools: (r.steps || []).map((s) => ({ tool: s.tool, ok: s.ok, durationMs: s.durationMs })),
            at: r.createdAt
          }))
        },
        prep: {
          byStatus: byStatus(prepByStatus),
          reviewed: prepTotals[0]?.reviewed || 0,
          approved: prepTotals[0]?.approved || 0,
          editedBeforeReview: prepTotals[0]?.edited || 0,
          avgTokens: Math.round(prepTotals[0]?.avgTokens || 0),
          avgDurationMs: Math.round(prepTotals[0]?.avgDurationMs || 0),
          rejections: rejections.map((d) => ({
            id: d._id,
            volunteer: d.volunteerId?.name || 'unknown',
            session: d.sessionId?.title || '',
            reason: d.reviewNote,
            at: d.reviewedAt,
            groups: (d.focusGroups || []).map((g) => `${g.subject}: ${g.topic}`)
          }))
        },
        evals: {
          retrieval: evalRetrieval.map((e) => ({
            id: e._id,
            at: e.createdAt,
            mode: e.config?.mode,
            threshold: e.config?.threshold,
            k: e.config?.k,
            embeddingModel: e.config?.embeddingModel,
            recall: e.metrics?.recallAtK,
            precision: e.metrics?.precisionAtK,
            mrr: e.metrics?.mrr,
            hitAt1: e.metrics?.hitAt1,
            misses: e.metrics?.misses,
            falsePositives: e.metrics?.falsePositives
          })),
          generation: evalGeneration.map((e) => ({
            id: e._id,
            at: e.createdAt,
            generator: e.config?.generator,
            judge: e.config?.judge,
            queries: e.metrics?.queries,
            passRate: e.metrics?.passRate,
            faithfulness: e.metrics?.faithfulness,
            gradeFit: e.metrics?.gradeFit,
            lowResource: e.metrics?.lowResource,
            completeness: e.metrics?.completeness
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    One agent run in full: the question, the answer, every step with its result preview
// @route   GET /api/ai/admin/runs/:id
// @access  Private (admin)
exports.getRun = async (req, res, next) => {
  try {
    const run = await AgentRun.findById(req.params.id).populate('userId', 'name email').lean();
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    res.status(200).json({ success: true, data: run });
  } catch (error) {
    next(error);
  }
};
