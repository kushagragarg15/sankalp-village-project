/**
 * Node -> Python (ai-service) internal client.
 *
 * The browser JWT never reaches Python and Python never re-derives a role
 * from it — `protect` (middleware/auth.js) already resolved `req.user`
 * (with its role cache/invalidation) before any caller gets here, so this
 * just forwards that trusted context under the shared secret. Rate limiting
 * and the daily token budget (middleware/aiBudget.js) stay in front of this
 * call in Node; ai-service does not re-implement either.
 *
 * Used by services/ragService.js (retrieval/generation/embedding),
 * controllers/aiController.js (resources, ask, ask/stream) and
 * scripts/seedResources.js.
 */

const crypto = require('crypto');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL;
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN;

const isConfigured = () => Boolean(AI_SERVICE_URL && AI_SERVICE_TOKEN);

// Retrieval and embedding calls are not personalised to whoever asked (the
// same club library, searched the same way, for everyone) — callers with no
// real signed-in user in scope (scripts, evals) use this identity for the
// service-to-service handshake. Never used for anything role-gated beyond
// that; ingestion (POST /rag/resources) is admin-only on the Python side, so
// callers that need it pass the real req.user instead.
const SYSTEM_USER = { id: 'system', role: 'admin', name: 'Sankalp RAG' };

const headersFor = (user, { body, requestId }) => {
  if (!user?.id || !user?.role || !user?.name) {
    throw new Error('aiServiceClient requires the resolved user { id, role, name }');
  }
  return {
    Authorization: `Bearer ${AI_SERVICE_TOKEN}`,
    'X-Sankalp-User-Id': String(user.id),
    'X-Sankalp-User-Role': String(user.role),
    'X-Sankalp-User-Name': encodeURIComponent(user.name),
    'X-Request-Id': requestId,
    ...(body ? { 'Content-Type': 'application/json' } : {})
  };
};

/**
 * Reads ai-service's JSON error body, in either shape it sends: the
 * structured provider-failure envelope `{code, retryAfterMs, message}`
 * (server/../ai-service/app/errors.py), or FastAPI's default `{detail}` for
 * everything else (validation, 403, 503-not-configured). Either way the
 * thrown Error carries `.status` and, when present, `.code`/`.retryAfterMs`
 * so callers can translate it into the same response shape the frontend
 * already expects without re-parsing message text.
 */
async function throwForStatus(res, requestId) {
  const payload = await res.json().catch(() => null);
  const err = new Error(payload?.message || payload?.detail || `ai-service responded ${res.status}`);
  err.status = res.status;
  err.requestId = requestId;
  if (payload?.code) err.code = payload.code;
  if (payload?.retryAfterMs !== undefined) err.retryAfterMs = payload.retryAfterMs;
  const retryAfterHeader = Number(res.headers.get('retry-after'));
  if (!err.retryAfterMs && retryAfterHeader) err.retryAfterMs = retryAfterHeader * 1000;
  throw err;
}

/**
 * @param {string} path - e.g. '/rag/retrieve'
 * @param {object} [options]
 * @param {'GET'|'POST'} [options.method]
 * @param {{id: string, role: string, name: string}} options.user - the trusted, already-resolved user (req.user)
 * @param {object} [options.body]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.requestId]
 */
async function callAiService(path, { method = 'GET', user, body, timeoutMs = 30000, requestId } = {}) {
  if (!isConfigured()) {
    throw new Error('AI service not configured. Set AI_SERVICE_URL and AI_SERVICE_TOKEN.');
  }
  requestId = requestId || crypto.randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method,
      headers: headersFor(user, { body, requestId }),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    if (!res.ok) await throwForStatus(res, requestId);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('ai-service did not respond in time.');
      timeoutErr.status = 504;
      timeoutErr.requestId = requestId;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Like callAiService, but for an `text/event-stream` route: returns the raw
 * fetch Response so the caller can pipe `res.body` straight through to the
 * browser as it arrives, instead of buffering a full answer in Node before
 * replying. Only a connection-level timeout applies here (opening the
 * stream) — once bytes are flowing there is no per-chunk timeout, the same
 * as the SSE connection this replaces.
 *
 * @param {string} path
 * @param {object} options - same shape as callAiService, plus `signal` (the
 *   caller's own AbortSignal, e.g. from the browser disconnecting)
 * @returns {Promise<Response>}
 */
async function streamAiService(path, { user, body, timeoutMs = 15000, requestId, signal } = {}) {
  if (!isConfigured()) {
    throw new Error('AI service not configured. Set AI_SERVICE_URL and AI_SERVICE_TOKEN.');
  }
  requestId = requestId || crypto.randomUUID();

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  // Only guards *opening* the connection — cleared as soon as headers arrive
  // so a long-running stream is never cut off mid-answer.
  const openTimeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: headersFor(user, { body, requestId }),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(openTimeout);

    if (!res.ok) await throwForStatus(res, requestId);
    return res;
  } catch (err) {
    clearTimeout(openTimeout);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('ai-service did not respond in time.');
      timeoutErr.status = 504;
      timeoutErr.requestId = requestId;
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Turns an error thrown by callAiService/streamAiService into
 * { status, message, retryAfterMs } — the same status codes and messages
 * the frontend already handles (401 for a bad provider key, 429 with a
 * human "try again in..." message for rate limits/no credits), sourced from
 * ai-service's structured envelope (app/errors.py) instead of re-parsing
 * message text the way this used to work when the chat call was local.
 */
function translateAiServiceError(error) {
  if (error.code === 'no_credits' || error.code === 'rate_limited') {
    return { status: 429, message: error.message, retryAfterMs: error.retryAfterMs || null };
  }
  if (error.code === 'provider_error') {
    return { status: /invalid .*api key/i.test(error.message) ? 401 : 503, message: error.message };
  }
  if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 503) {
    return { status: error.status, message: error.message };
  }
  if (error.status === 504) {
    return { status: 504, message: 'The AI service did not respond in time. Try again.' };
  }
  return { status: 503, message: 'AI service is unavailable right now. Try again shortly.' };
}

module.exports = { callAiService, streamAiService, translateAiServiceError, isConfigured, SYSTEM_USER };
