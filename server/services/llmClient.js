// Provider selection happens at require time, so the env must be loaded by
// then regardless of which script required us first. dotenv never overrides
// variables that are already set, so this is a harmless no-op in server.js.
require('dotenv').config();
const OpenAI = require('openai');

/**
 * One place that knows which LLM providers we are talking to.
 *
 * Every provider here speaks the OpenAI wire format — Gemini and Groq through
 * their OpenAI-compatible endpoints — so every caller uses the `openai` SDK
 * and only this file knows about keys, base URLs and model names. Swapping
 * providers is an environment change, not a code change.
 *
 * Chat and embeddings are chosen separately, because not every provider does
 * both (Groq has no embedding models) and because the cheapest chat model and
 * the best embedding model rarely live in the same place:
 *
 *   LLM_PROVIDER        = groq | gemini | openai   chat/agent provider
 *   EMBEDDING_PROVIDER  = gemini | openai          defaults to LLM_PROVIDER if it
 *                                                  has embeddings, else gemini
 *   LLM_CHAT_MODEL, LLM_EMBEDDING_MODEL            optional model overrides
 *
 * With no LLM_PROVIDER set, the first provider with a key wins, in the order
 * listed below (free and fast first).
 *
 * The one thing that does *not* swap freely is the embedding model: vectors
 * from different models live in different spaces and must never be compared.
 * EMBEDDING_MODEL is stamped on every Resource at ingest and retrieval only
 * reads resources embedded with the model in use. Change it → re-run
 * `npm run seed-resources`.
 */

const PROVIDERS = {
  groq: {
    apiKeyEnv: 'GROQ_API_KEY',
    baseURL: 'https://api.groq.com/openai/v1',
    // Open-weights reasoning model with solid tool use; ~0.5s per turn on Groq.
    chatModel: 'openai/gpt-oss-120b',
    embeddingModel: null,
    similarityThreshold: null
  },
  gemini: {
    apiKeyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    // Free tier: 20 requests/day on gemini-3.5-flash. An agent question is
    // 2-5 requests, so this is a demo budget, not a development one.
    chatModel: 'gemini-3.5-flash',
    embeddingModel: 'gemini-embedding-001',
    // Measured 2026-09 on the seeded library: on-topic chunks score ~0.70-0.75,
    // unrelated ones ~0.55-0.58. 0.62 keeps the former and drops the latter.
    similarityThreshold: 0.62
  },
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    baseURL: undefined,
    chatModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    similarityThreshold: 0.75
  }
};

const hasKey = (name) => Boolean(process.env[PROVIDERS[name].apiKeyEnv]);

const pick = (envVar, candidates) => {
  const explicit = process.env[envVar] && process.env[envVar].toLowerCase();
  if (explicit) {
    if (!candidates.includes(explicit)) {
      throw new Error(`Unknown ${envVar} "${explicit}". Use one of: ${candidates.join(', ')}`);
    }
    return explicit;
  }
  // Auto-detect: first candidate that has a key. Fall back to the first so
  // isConfigured() can say "no" with a useful env-var name.
  return candidates.find(hasKey) || candidates[0];
};

const CHAT_PROVIDER = pick('LLM_PROVIDER', ['groq', 'gemini', 'openai']);

const embeddingCapable = ['gemini', 'openai'];
const EMBEDDING_PROVIDER = pick(
  'EMBEDDING_PROVIDER',
  // Prefer the chat provider when it can embed, so a single-provider setup
  // stays single-provider.
  embeddingCapable.includes(CHAT_PROVIDER)
    ? [CHAT_PROVIDER, ...embeddingCapable.filter((p) => p !== CHAT_PROVIDER)]
    : embeddingCapable
);

const CHAT_MODEL =
  process.env.LLM_CHAT_MODEL || process.env.OPENAI_AGENT_MODEL || PROVIDERS[CHAT_PROVIDER].chatModel;
const EMBEDDING_MODEL = process.env.LLM_EMBEDDING_MODEL || PROVIDERS[EMBEDDING_PROVIDER].embeddingModel;
// Cosine-similarity cut-off for "relevant". This is a property of the embedding
// model, not of the retriever: different models spread their scores differently,
// so a threshold tuned for one silently returns nothing (or everything) on another.
const SIMILARITY_THRESHOLD = Number(
  process.env.RAG_SIMILARITY_THRESHOLD || PROVIDERS[EMBEDDING_PROVIDER].similarityThreshold || 0.7
);

const clients = new Map();
const clientFor = (name) => {
  const p = PROVIDERS[name];
  if (!hasKey(name)) throw new Error(`${p.apiKeyEnv} not configured`);
  if (!clients.has(name)) {
    // maxRetries 0: the agent loop owns retries (createCompletionWithRetry) so
    // that every 429 is logged and backed off deliberately, not hidden in the SDK.
    clients.set(name, new OpenAI({ apiKey: process.env[p.apiKeyEnv], baseURL: p.baseURL, maxRetries: 0 }));
  }
  return clients.get(name);
};

/** True when both the chat and embedding providers have keys. The rest of the app runs without. */
const isConfigured = () => hasKey(CHAT_PROVIDER) && hasKey(EMBEDDING_PROVIDER);

/** Message for a 503 when a caller needs the LLM and a key is missing. */
const notConfiguredMessage = () => {
  const missing = [CHAT_PROVIDER, EMBEDDING_PROVIDER]
    .filter((p) => !hasKey(p))
    .map((p) => PROVIDERS[p].apiKeyEnv);
  return `AI service not configured. Please add ${[...new Set(missing)].join(' and ')} to environment variables.`;
};

/** SDK client for chat completions (the agent and the lesson planner). */
const getClient = () => clientFor(CHAT_PROVIDER);

// Free-tier providers rate-limit per minute; the SDK's own backoff (max ~8s)
// gives up long before the window resets, so clients are built with
// maxRetries 0 and this is the one retry path for every chat call.
const RETRY_DELAYS_MS = [2000, 5000, 12000, 25000];
// A provider may ask us to wait minutes (a daily quota, say). Nobody is going
// to sit at a spinner that long: past this cap we fail at once and pass the
// suggested wait up, so the user sees "try again in 4 minutes" instead.
const MAX_RETRY_WAIT_MS = Number(process.env.LLM_MAX_RETRY_WAIT_MS || 30000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long the provider asked us to wait, if it said. Groq puts it in the
// message ("Please try again in 11.2s"), others in a Retry-After header.
const suggestedDelayMs = (err) => {
  const header = Number(err.headers?.['retry-after']);
  if (header > 0) return header * 1000;
  // "11.2s", "4m1.05s", "1h2m3s" — Groq writes the wait in mixed units.
  const m = /try again in ((?:\d+h)?(?:\d+m)?(?:[\d.]+s)?)/i.exec(err.message || '');
  if (m && m[1]) {
    const h = Number((/(\d+)h/.exec(m[1]) || [])[1] || 0);
    const min = Number((/(\d+)m/.exec(m[1]) || [])[1] || 0);
    const sec = Number((/([\d.]+)s/.exec(m[1]) || [])[1] || 0);
    const total = h * 3600 + min * 60 + sec;
    if (total > 0) return Math.ceil(total * 1000) + 500;
  }
  return null;
};

/**
 * chat.completions.create with retry on 429 (rate limit) and 5xx (provider
 * hiccup). Anything else — a bad key, a bad request — will not get better by
 * waiting and is thrown at once.
 */
async function chatWithRetry(params) {
  const openai = getClient();
  for (let attempt = 0; ; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      const retryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      const suggested = suggestedDelayMs(err);
      if (suggested && suggested > MAX_RETRY_WAIT_MS) {
        err.retryAfterMs = suggested;
        throw err;
      }
      const delay = suggested || RETRY_DELAYS_MS[attempt];
      console.warn(`LLM ${err.status}; retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await sleep(delay);
    }
  }
}

/**
 * Streaming variant of chatWithRetry. Retries apply to *opening* the stream
 * (that is where a 429 arrives); once chunks are flowing, a failure is the
 * caller's to handle — half an answer cannot be retried transparently.
 * Asks the provider to append usage to the final chunk so streamed calls are
 * accounted for like the rest.
 */
async function chatStreamWithRetry(params) {
  const openai = getClient();
  for (let attempt = 0; ; attempt++) {
    try {
      return await openai.chat.completions.create({
        ...params,
        stream: true,
        stream_options: { include_usage: true }
      });
    } catch (err) {
      const retryable = err.status === 429 || (err.status >= 500 && err.status < 600);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      const suggested = suggestedDelayMs(err);
      if (suggested && suggested > MAX_RETRY_WAIT_MS) {
        err.retryAfterMs = suggested;
        throw err;
      }
      const delay = suggested || RETRY_DELAYS_MS[attempt];
      console.warn(`LLM ${err.status} (stream); retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await sleep(delay);
    }
  }
}

module.exports = {
  PROVIDER: CHAT_PROVIDER,
  CHAT_PROVIDER,
  EMBEDDING_PROVIDER,
  CHAT_MODEL,
  EMBEDDING_MODEL,
  SIMILARITY_THRESHOLD,
  isConfigured,
  notConfiguredMessage,
  getClient,
  chatWithRetry,
  chatStreamWithRetry
};
