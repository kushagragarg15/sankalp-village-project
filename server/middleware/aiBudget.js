const { sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { agentRuns, lessonPlanDrafts } = require('../db/schema');

/**
 * Two guardrails in front of every endpoint that spends model tokens.
 *
 * 1. A per-user request rate limit (sliding window, in memory).
 * 2. A per-user daily token budget, computed from what the audit trail says
 *    they already spent today (agent_runs + lesson_plan_drafts usage).
 *    Persisted usage means the budget survives a restart, and the same
 *    numbers show on the admin AI-activity page — one source of truth.
 *
 * Both answer 429 with a Retry-After the client can show. Admins are not
 * exempt: the point is the shared quota, not trust.
 */

const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_REQUESTS || 12);
const RATE_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const DAILY_TOKEN_BUDGET = Number(process.env.AI_DAILY_TOKEN_BUDGET_PER_USER || 150000);
const BUDGET_CACHE_MS = 30 * 1000;

const windows = new Map(); // userId -> [timestamps]
const budgetCache = new Map(); // userId -> { spent, expires }

setInterval(() => {
  const now = Date.now();
  for (const [id, stamps] of windows) {
    const live = stamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (live.length) windows.set(id, live);
    else windows.delete(id);
  }
  for (const [id, entry] of budgetCache) if (entry.expires <= now) budgetCache.delete(id);
}, 60 * 1000).unref();

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Tokens this user has spent since midnight, from the persisted audit rows. */
async function tokensSpentToday(userId) {
  const since = startOfToday();
  const db = getDb();
  const [agentRow, prepRow] = await Promise.all([
    db
      .execute(
        sql`SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS t FROM ${agentRuns} WHERE user_id = ${userId} AND created_at >= ${since}`
      )
      .then((r) => r.rows[0]),
    db
      .execute(
        sql`SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::int AS t FROM ${lessonPlanDrafts} WHERE volunteer_id = ${userId} AND created_at >= ${since}`
      )
      .then((r) => r.rows[0])
  ]);
  return (agentRow?.t || 0) + (prepRow?.t || 0);
}

/** Forget the cached spend for a user — call after a run is persisted. */
const invalidateBudget = (userId) => budgetCache.delete(String(userId));

exports.aiRateLimit = (req, res, next) => {
  const id = String(req.user.id);
  const now = Date.now();
  const stamps = (windows.get(id) || []).filter((t) => now - t < RATE_WINDOW_MS);

  if (stamps.length >= RATE_LIMIT) {
    const retryAfter = Math.ceil((stamps[0] + RATE_WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      message: `That is a lot of questions at once. Try again in about ${Math.ceil(retryAfter / 60)} minute${retryAfter > 90 ? 's' : ''}.`
    });
  }

  stamps.push(now);
  windows.set(id, stamps);
  next();
};

exports.aiDailyBudget = async (req, res, next) => {
  try {
    const id = String(req.user.id);
    const cached = budgetCache.get(id);
    const spent = cached && cached.expires > Date.now() ? cached.spent : await tokensSpentToday(req.user.id);
    budgetCache.set(id, { spent, expires: Date.now() + BUDGET_CACHE_MS });

    res.set('X-AI-Tokens-Used-Today', String(spent));
    res.set('X-AI-Tokens-Budget', String(DAILY_TOKEN_BUDGET));

    if (spent >= DAILY_TOKEN_BUDGET) {
      const untilMidnight = Math.ceil((startOfToday().getTime() + 86400000 - Date.now()) / 1000);
      res.set('Retry-After', String(untilMidnight));
      return res.status(429).json({
        success: false,
        message: "You have used today's AI allowance. It resets at midnight — or ask the coordinator to raise it."
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

exports.invalidateBudget = invalidateBudget;
exports.tokensSpentToday = tokensSpentToday;
exports.DAILY_TOKEN_BUDGET = DAILY_TOKEN_BUDGET;
exports.RATE_LIMIT = RATE_LIMIT;
exports.RATE_WINDOW_MS = RATE_WINDOW_MS;
