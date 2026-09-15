const { sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { agentRuns, agentRunSteps, lessonPlanDrafts, evalRuns } = require('../db/schema');
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
    const db = getDb();
    const since7 = daysAgo(7);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const [
      agentTotals,
      agentByStatus,
      agentToolUse,
      agentByUser,
      recentRuns,
      prepByStatus,
      rejections,
      prepTotals,
      evalRetrieval,
      evalGeneration
    ] = await Promise.all([
      db
        .execute(sql`
          SELECT COUNT(*)::int AS runs,
                 COUNT(*) FILTER (WHERE created_at >= ${midnight})::int AS today,
                 COALESCE(SUM(prompt_tokens), 0)::int AS prompt_tokens,
                 COALESCE(SUM(completion_tokens), 0)::int AS completion_tokens,
                 COALESCE(AVG(duration_ms), 0) AS avg_duration_ms,
                 COALESCE(AVG(llm_ms), 0) AS avg_llm_ms,
                 COALESCE(AVG(iterations), 0) AS avg_iterations
          FROM ${agentRuns} WHERE created_at >= ${since7}
        `)
        .then((r) => r.rows[0]),
      db
        .execute(sql`SELECT status, COUNT(*)::int AS count FROM ${agentRuns} WHERE created_at >= ${since7} GROUP BY status`)
        .then((r) => r.rows),
      db
        .execute(sql`
          SELECT s.tool AS tool, COUNT(*)::int AS calls,
                 COUNT(*) FILTER (WHERE s.ok = false)::int AS failures,
                 COALESCE(AVG(s.duration_ms), 0) AS avg_ms
          FROM ${agentRunSteps} s
          JOIN ${agentRuns} r ON r.id = s.run_id
          WHERE r.created_at >= ${since7}
          GROUP BY s.tool
          ORDER BY calls DESC
        `)
        .then((r) => r.rows),
      db
        .execute(sql`
          SELECT r.user_id AS user_id, u.name AS name, u.role AS role,
                 COUNT(*)::int AS runs,
                 COALESCE(SUM(r.prompt_tokens + r.completion_tokens), 0)::int AS tokens
          FROM ${agentRuns} r
          LEFT JOIN users u ON u.id = r.user_id
          WHERE r.created_at >= ${midnight}
          GROUP BY r.user_id, u.name, u.role
          ORDER BY tokens DESC
          LIMIT 10
        `)
        .then((r) => r.rows),
      db
        .execute(sql`
          SELECT r.id AS id, u.name AS user_name, r.role AS role, r.question AS question, r.answer AS answer,
                 r.status AS status, r.model AS model, r.iterations AS iterations, r.duration_ms AS duration_ms,
                 r.llm_ms AS llm_ms, (r.prompt_tokens + r.completion_tokens) AS tokens, r.created_at AS created_at,
                 COALESCE(
                   (SELECT json_agg(json_build_object('tool', s.tool, 'ok', s.ok, 'durationMs', s.duration_ms) ORDER BY s.iteration)
                    FROM ${agentRunSteps} s WHERE s.run_id = r.id),
                   '[]'::json
                 ) AS tools
          FROM ${agentRuns} r
          LEFT JOIN users u ON u.id = r.user_id
          ORDER BY r.created_at DESC
          LIMIT 40
        `)
        .then((r) => r.rows),

      db.execute(sql`SELECT status, COUNT(*)::int AS count FROM ${lessonPlanDrafts} GROUP BY status`).then((r) => r.rows),
      db
        .execute(sql`
          SELECT d.id AS id, v.name AS volunteer_name, s.title AS session_title, d.review_note AS review_note, d.reviewed_at AS reviewed_at,
                 d.focus_groups AS focus_groups
          FROM ${lessonPlanDrafts} d
          LEFT JOIN users v ON v.id = d.volunteer_id
          LEFT JOIN attendance_sessions s ON s.id = d.session_id
          WHERE d.status = 'rejected'
          ORDER BY d.reviewed_at DESC
          LIMIT 15
        `)
        .then((r) => r.rows),
      db
        .execute(sql`
          SELECT COUNT(*)::int AS reviewed,
                 COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
                 COUNT(*) FILTER (WHERE edited_by_volunteer)::int AS edited,
                 COALESCE(AVG(prompt_tokens + completion_tokens), 0) AS avg_tokens,
                 COALESCE(AVG(duration_ms), 0) AS avg_duration_ms
          FROM ${lessonPlanDrafts} WHERE status IN ('approved', 'rejected')
        `)
        .then((r) => r.rows[0]),

      db
        .execute(sql`SELECT id, config, metrics, created_at FROM ${evalRuns} WHERE kind = 'retrieval' ORDER BY created_at DESC LIMIT 12`)
        .then((r) => r.rows),
      db
        .execute(sql`SELECT id, config, metrics, created_at FROM ${evalRuns} WHERE kind = 'generation' ORDER BY created_at DESC LIMIT 8`)
        .then((r) => r.rows)
    ]);

    const byStatus = (rows) => Object.fromEntries(rows.map((r) => [r.status, r.count]));
    const a = agentTotals || {};

    // avgSteps per run, over the same 7-day window (one extra scalar query —
    // cheap, and keeps the main aggregate above free of a second join).
    const [{ avg_steps: avgSteps }] = (
      await db.execute(sql`
        SELECT COALESCE(AVG(step_count), 0) AS avg_steps FROM (
          SELECT r.id, COUNT(s.id) AS step_count FROM ${agentRuns} r
          LEFT JOIN ${agentRunSteps} s ON s.run_id = r.id
          WHERE r.created_at >= ${since7}
          GROUP BY r.id
        ) counted
      `)
    ).rows;

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
            tokens: (a.prompt_tokens || 0) + (a.completion_tokens || 0),
            avgDurationMs: Math.round(Number(a.avg_duration_ms) || 0),
            avgLlmMs: Math.round(Number(a.avg_llm_ms) || 0),
            avgIterations: Number((Number(a.avg_iterations) || 0).toFixed(1)),
            avgSteps: Number((Number(avgSteps) || 0).toFixed(1)),
            byStatus: byStatus(agentByStatus)
          },
          tools: agentToolUse.map((t) => ({ tool: t.tool, calls: t.calls, failures: t.failures, avgMs: Math.round(Number(t.avg_ms) || 0) })),
          spendToday: agentByUser.map((u) => ({ name: u.name || 'unknown', role: u.role, runs: u.runs, tokens: u.tokens })),
          recent: recentRuns.map((r) => ({
            id: r.id,
            user: r.user_name || 'unknown',
            role: r.role,
            question: r.question,
            answerPreview: (r.answer || '').slice(0, 160),
            status: r.status,
            model: r.model,
            iterations: r.iterations,
            durationMs: r.duration_ms,
            llmMs: r.llm_ms,
            tokens: r.tokens,
            tools: r.tools || [],
            at: r.created_at
          }))
        },
        prep: {
          byStatus: byStatus(prepByStatus),
          reviewed: prepTotals?.reviewed || 0,
          approved: prepTotals?.approved || 0,
          editedBeforeReview: prepTotals?.edited || 0,
          avgTokens: Math.round(Number(prepTotals?.avg_tokens) || 0),
          avgDurationMs: Math.round(Number(prepTotals?.avg_duration_ms) || 0),
          rejections: rejections.map((d) => ({
            id: d.id,
            volunteer: d.volunteer_name || 'unknown',
            session: d.session_title || '',
            reason: d.review_note,
            at: d.reviewed_at,
            groups: (d.focus_groups || []).map((g) => `${g.subject}: ${g.topic}`)
          }))
        },
        evals: {
          retrieval: evalRetrieval.map((e) => ({
            id: e.id,
            at: e.created_at,
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
            id: e.id,
            at: e.created_at,
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
    const db = getDb();
    const result = await db.execute(sql`
      SELECT r.*, u.name AS user_name, u.email AS user_email,
             COALESCE(
               (SELECT json_agg(json_build_object(
                  'iteration', s.iteration, 'tool', s.tool, 'args', s.args, 'ok', s.ok,
                  'durationMs', s.duration_ms, 'resultPreview', s.result_preview, 'error', s.error
                ) ORDER BY s.iteration) FROM ${agentRunSteps} s WHERE s.run_id = r.id),
               '[]'::json
             ) AS steps
      FROM ${agentRuns} r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ${req.params.id}
    `);

    const run = result.rows[0];
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });

    res.status(200).json({
      success: true,
      data: {
        _id: run.id,
        id: run.id,
        userId: { _id: run.user_id, id: run.user_id, name: run.user_name, email: run.user_email },
        role: run.role,
        question: run.question,
        answer: run.answer,
        status: run.status,
        model: run.model,
        iterations: run.iterations,
        durationMs: run.duration_ms,
        llmMs: run.llm_ms,
        usage: { promptTokens: run.prompt_tokens, completionTokens: run.completion_tokens },
        steps: run.steps,
        error: run.error,
        createdAt: run.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};
