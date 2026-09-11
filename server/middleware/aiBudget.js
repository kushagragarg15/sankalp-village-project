const AgentRun = require('../models/AgentRun');
const LessonPlanDraft = require('../models/LessonPlanDraft');

/**
 * Two guardrails in front of every endpoint that spends model tokens.
 *
 * 1. A per-user request rate limit (sliding window, in memory). Stops a stuck
 *    client or an enthusiastic tester from burning the free-tier minute for
 *    everyone else — the provider limit is shared by the whole club.
 * 2. A per-user daily token budget, computed from what the audit trail says
 *    they already spent today (AgentRun + LessonPlanDraft usage). Persisted
 *    usage means the budget survives a restart, and the same numbers show on
 *    the admin AI-activity page — one source of truth.
 *
 * Both answer 429 with a Retry-After the client can show. Admins are not
 * exempt: the point is the shared quota, not trust.
 */

const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT_REQUESTS || 12);
const RATE_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const DAILY_TOKEN_BUDGET = Number(process.env.AI_DAILY_TOKEN_BUDGET_PER_USER || 150000);
// The budget check is one aggregate (~30ms on Atlas); cache it briefly so a
// chatty session does not pay that on every message.
const BUDGET_CACHE_MS = 30 * 1000;

const windows = new Map(); // userId -> [timestamps]
const budgetCache = new Map(); // userId -> { spent, expires }

// Keep both maps from growing without bound on a long-lived process.
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
  const [agent, prep] = await Promise.all([
    AgentRun.aggregate([
      { $match: { userId, createdAt: { $gte: since } } },
      { $group: { _id: null, t: { $sum: { $add: ['$usage.promptTokens', '$usage.completionTokens'] } } } }
    ]),
    LessonPlanDraft.aggregate([
      { $match: { volunteerId: userId, createdAt: { $gte: since } } },
      { $group: { _id: null, t: { $sum: { $add: ['$usage.promptTokens', '$usage.completionTokens'] } } } }
    ])
  ]);
  return (agent[0]?.t || 0) + (prep[0]?.t || 0);
}

/** Forget the cached spend for a user — call after a run is persisted. */
const invalidateBudget = (userId) => budgetCache.delete(String(userId));

exports.aiRateLimit = (req, res, next) => {
  const id = String(req.user._id);
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
    const id = String(req.user._id);
    const cached = budgetCache.get(id);
    const spent = cached && cached.expires > Date.now() ? cached.spent : await tokensSpentToday(req.user._id);
    budgetCache.set(id, { spent, expires: Date.now() + BUDGET_CACHE_MS });

    // Surfaced so the client can warn before the wall, not after.
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
