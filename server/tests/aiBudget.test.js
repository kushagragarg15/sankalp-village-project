const { createMockDb } = require('./helpers/mockDb');

// The middleware reads its limits at require time, so pin them before
// loading it: 3 requests per minute, 1 000 tokens per day.
process.env.AI_RATE_LIMIT_REQUESTS = '3';
process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
process.env.AI_DAILY_TOKEN_BUDGET_PER_USER = '1000';

const mockDb = createMockDb();
jest.mock('../db', () => ({ getDb: () => mockDb, schema: jest.requireActual('../db/schema') }));

const { aiRateLimit, aiDailyBudget, invalidateBudget } = require('../middleware/aiBudget');

// Minimal req/res/next doubles — enough to observe status, body and headers.
const mockReq = (userId) => ({ user: { id: userId } });
const mockRes = () => {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.set = (k, v) => {
    res.headers[k] = v;
    return res;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

let counter = 0;
// Each test gets its own user so the module-level sliding windows and
// budget caches never bleed between tests.
const freshUser = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

describe('aiRateLimit', () => {
  test('lets the first N requests through, then answers 429 with Retry-After', () => {
    const userId = freshUser();
    const next = jest.fn();

    for (let i = 0; i < 3; i++) aiRateLimit(mockReq(userId), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(3);

    const res = mockRes();
    aiRateLimit(mockReq(userId), res, next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(res.statusCode).toBe(429);
    expect(res.body.success).toBe(false);
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
    expect(Number(res.headers['Retry-After'])).toBeLessThanOrEqual(60);
  });

  test('limits are per user — one user being throttled does not affect another', () => {
    const a = freshUser();
    const b = freshUser();
    const next = jest.fn();
    for (let i = 0; i < 4; i++) aiRateLimit(mockReq(a), mockRes(), next);
    const res = mockRes();
    aiRateLimit(mockReq(b), res, next);
    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(4); // 3 for a + 1 for b
  });
});

describe('aiDailyBudget', () => {
  // tokensSpentToday issues two SUM queries (agent_runs, lesson_plan_drafts).
  const queueSpend = (agent, prep) => {
    mockDb.queueExecute({ rows: [{ t: agent }] });
    mockDb.queueExecute({ rows: [{ t: prep }] });
  };

  test('passes through under budget and reports usage in headers', async () => {
    const userId = freshUser();
    queueSpend(300, 200);
    const res = mockRes();
    const next = jest.fn();

    await aiDailyBudget(mockReq(userId), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.headers['X-AI-Tokens-Used-Today']).toBe('500');
    expect(res.headers['X-AI-Tokens-Budget']).toBe('1000');
  });

  test('answers 429 once the persisted spend reaches the budget', async () => {
    const userId = freshUser();
    queueSpend(900, 100);
    const res = mockRes();
    const next = jest.fn();

    await aiDailyBudget(mockReq(userId), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.message).toMatch(/AI allowance/);
    // Resets at midnight, so Retry-After is at most a day.
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0);
    expect(Number(res.headers['Retry-After'])).toBeLessThanOrEqual(86400);
  });

  test('caches the spend for a user and forgets it on invalidateBudget', async () => {
    const userId = freshUser();
    const next = jest.fn();
    queueSpend(10, 0);
    mockDb.execute.mockClear();

    await aiDailyBudget(mockReq(userId), mockRes(), next);
    await aiDailyBudget(mockReq(userId), mockRes(), next);
    expect(mockDb.execute).toHaveBeenCalledTimes(2); // one pair of SUMs, second call served from cache

    invalidateBudget(userId);
    queueSpend(20, 0);
    const res = mockRes();
    await aiDailyBudget(mockReq(userId), res, next);
    expect(mockDb.execute).toHaveBeenCalledTimes(4);
    expect(res.headers['X-AI-Tokens-Used-Today']).toBe('20');
  });

  test('forwards a database failure to the error handler instead of crashing', async () => {
    const userId = freshUser();
    mockDb.execute.mockImplementationOnce(() => Promise.reject(new Error('connection lost')));
    mockDb.queueExecute({ rows: [{ t: 0 }] });
    const next = jest.fn();

    await aiDailyBudget(mockReq(userId), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
