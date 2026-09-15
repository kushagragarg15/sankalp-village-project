const { callAiService, SYSTEM_USER } = require('./aiServiceClient');

// 'vector' ranks by cosine similarity alone; 'hybrid' fuses cosine and BM25
// rankings with RRF. Mirrors ai-service's own default/env var — shown here
// only for callers (the admin activity page) that display it; the actual
// mode selection now happens in Python (server/../ai-service/app/rag).
const RETRIEVAL_MODE = (process.env.RETRIEVAL_MODE || 'vector').toLowerCase();

/**
 * Retrieve relevant context chunks from the resource library.
 *
 * This is now a thin proxy: every part of retrieval — the subject/grade/
 * embedding-model prefilter, the pgvector cosine-similarity query, the
 * vector/hybrid ranking and gating — runs in the Python ai-service
 * (app/rag/retriever.py), the only place in the project that does vector
 * search. Node no longer touches resource_chunks directly.
 *
 * @param {object} params - Retrieval parameters
 * @param {string} params.topic - The lesson topic
 * @param {string} params.subject - The subject (Math, Science, etc.)
 * @param {string} params.grade - The grade/class level
 * @param {number} [params.k] - Number of top chunks to retrieve (ai-service default: 5)
 * @param {number} [params.minSimilarity] - Minimum similarity threshold (ai-service default: the embedding model's threshold)
 * @param {string} [params.mode] - 'vector' | 'hybrid' (ai-service default: RETRIEVAL_MODE)
 * @param {number[]} [params.queryEmbedding] - Callers that already hold the query vector (the eval harness) can pass it in.
 * @returns {Promise<Array<{text: string, similarity: number, lexical: number, source: object}>>}
 */
async function retrieveContext({ topic, subject, grade, k, minSimilarity, mode, queryEmbedding = null }) {
  const body = { topic, subject, grade };
  if (k !== undefined) body.k = k;
  if (minSimilarity !== undefined) body.min_similarity = minSimilarity;
  if (mode !== undefined) body.mode = mode;
  if (queryEmbedding !== null) body.query_embedding = queryEmbedding;

  const result = await callAiService('/rag/retrieve', { method: 'POST', user: SYSTEM_USER, body });
  return result.chunks;
}

/**
 * Generate a lesson plan using RAG: retrieve then generate. Both halves now
 * run in the ai-service (app/rag/generation.py) — the only place in the
 * project that writes a lesson plan, so POST /api/ai/generate-notes, the
 * draft_lesson_plan agent tool and the generation eval all produce the exact
 * same output for the exact same input.
 *
 * Errors are re-thrown as ai-service returned them (`.status`, and — for a
 * provider failure — `.code`/`.retryAfterMs` from the structured envelope in
 * app/errors.py) rather than rewrapped, so a caller that wants to translate
 * them (aiController.generateTeachingNotes) can do so without re-parsing
 * message text.
 *
 * @param {object} params - Generation parameters
 * @param {string} params.topic - The lesson topic
 * @param {string} params.subject - The subject
 * @param {string} params.grade - The grade/class level
 * @param {string} params.extraInstructions - Optional additional instructions
 * @param {number} params.k - Number of context chunks to retrieve
 * @returns {Promise<{lessonPlan: string, sources: Array, contextChunks: Array}>}
 */
async function generateLessonPlan({ topic, subject, grade, extraInstructions = '', k = 5 }) {
  return callAiService('/rag/lesson-plan', {
    method: 'POST',
    user: SYSTEM_USER,
    body: { topic, subject, grade, extra_instructions: extraInstructions, k },
    timeoutMs: 60000
  });
}

module.exports = {
  retrieveContext,
  generateLessonPlan,
  RETRIEVAL_MODE
};
