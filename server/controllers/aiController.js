const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { eq, and, ne, asc, desc, inArray, sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { resources, agentRuns, agentRunSteps } = require('../db/schema');
const { withId } = require('../db/serialize');
const { UUID_RE } = require('../middleware/auth');
const { isConfigured, notConfiguredMessage } = require('../services/llmClient');
const { invalidateBudget } = require('../middleware/aiBudget');
const { callAiService, streamAiService, translateAiServiceError } = require('../services/aiServiceClient');

/**
 * Two accepted shapes for a question:
 *   { conversationId?, question }   — the server rebuilds history (preferred)
 *   { messages: [{ role, content }] } — a client-sent transcript (older clients)
 * A conversationId, when given, must be a valid id; ownership is enforced when
 * history is loaded (only this user's runs are read).
 */
function parseAskBody(body = {}) {
  if (typeof body.question === 'string') {
    const question = body.question.trim();
    if (!question) return { error: 'question must not be empty' };
    if (body.conversationId !== undefined && body.conversationId !== null && body.conversationId !== '') {
      if (!UUID_RE.test(String(body.conversationId))) return { error: 'conversationId is not valid' };
      return { question, conversationId: String(body.conversationId) };
    }
    return { question };
  }
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'Send { question } (with an optional conversationId), or messages as a non-empty array of { role, content }' };
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string' || !last.content.trim()) {
    return { error: 'The last message must be a non-empty user message' };
  }
  return { messages };
}

// @desc    Generate teaching notes using RAG (Retrieval-Augmented Generation)
// @route   POST /api/ai/generate-notes
// @access  Private
exports.generateTeachingNotes = async (req, res, next) => {
  try {
    const { topic, grade, subject, extraInstructions } = req.body;

    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    if (!subject || !grade) {
      return res.status(400).json({ success: false, message: 'Subject and grade are required' });
    }

    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    const result = await callAiService('/rag/lesson-plan', {
      method: 'POST',
      user: req.user,
      body: { topic, subject, grade, extra_instructions: extraInstructions || '' },
      timeoutMs: 60000
    });

    res.status(200).json({
      success: true,
      data: {
        topic,
        grade,
        subject,
        notes: result.lessonPlan,
        sources: result.sources,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error in generateTeachingNotes:', error);
    const translated = translateAiServiceError(error);
    if (translated.retryAfterMs) res.set('Retry-After', String(Math.ceil(translated.retryAfterMs / 1000)));
    res.status(translated.status).json({ success: false, message: translated.message });
  }
};

// @desc    Create a new teaching resource (admin only)
// @route   POST /api/ai/resources
// @access  Private (Admin)
exports.createResource = async (req, res, next) => {
  try {
    const { title, subject, grade, content } = req.body;

    if (!title || !subject || !grade || !content) {
      return res.status(400).json({ success: false, message: 'Title, subject, grade, and content are required' });
    }

    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    // Chunking + embedding + storage all happen in the Python ai-service now
    // (app/rag/ingest.py) — the only place a resource's chunks are written.
    const result = await callAiService('/rag/resources', {
      method: 'POST',
      user: req.user,
      body: { title, subject, grade, content }
    });

    res.status(201).json({
      success: true,
      data: { _id: result.id, id: result.id, title: result.title, subject: result.subject, grade: result.grade, chunks: result.chunks }
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

// @desc    Get all teaching resources
// @route   GET /api/ai/resources
// @access  Private
exports.getResources = async (req, res, next) => {
  try {
    const { subject, grade } = req.query;
    const db = getDb();

    const conditions = [];
    if (subject) conditions.push(sql`${resources.subject} ILIKE ${'%' + subject + '%'}`);
    if (grade) conditions.push(sql`${resources.grade} ILIKE ${'%' + grade + '%'}`);

    let query = db.select().from(resources);
    if (conditions.length > 0) query = query.where(and(...conditions));
    const rows = await query.orderBy(desc(resources.createdAt));

    res.status(200).json({ success: true, count: rows.length, data: rows.map(withId) });
  } catch (error) {
    console.error('Error fetching resources:', error);
    next(error);
  }
};

// @desc    Ask the tool-using agent a question about the club's data
// @route   POST /api/ai/ask
// @access  Private (tools are scoped to req.user.role inside ai-service)
exports.askAgent = async (req, res, next) => {
  try {
    const input = parseAskBody(req.body);
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    const requestId = crypto.randomUUID();
    const result = await callAiService('/agent/ask', {
      method: 'POST',
      user: req.user,
      body: input,
      timeoutMs: 60000,
      requestId
    });
    invalidateBudget(req.user.id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in askAgent:', error);
    const translated = translateAiServiceError(error);
    if (translated.retryAfterMs) res.set('Retry-After', String(Math.ceil(translated.retryAfterMs / 1000)));
    res.status(translated.status).json({ success: false, message: translated.message });
  }
};

// @desc    Ask the agent, streaming progress and the answer as Server-Sent Events
// @route   POST /api/ai/ask/stream
// @access  Private
//
// ai-service runs the LangGraph agent and streams its own SSE response;
// this just opens that connection and pipes the bytes straight through to
// the browser as they arrive — the answer is never assembled in Node.
exports.askAgentStream = async (req, res, next) => {
  const input = parseAskBody(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  if (!isConfigured()) {
    return res.status(503).json({ success: false, message: notConfiguredMessage() });
  }

  const requestId = crypto.randomUUID();
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  let upstream;
  try {
    // Failures here (validation, a provider error before any token streamed,
    // ai-service unreachable) happen before any SSE header is sent, so a
    // normal JSON error response is correct — same as the old guardrail
    // checks above returning plain 400/503 rather than an SSE `error` event.
    upstream = await streamAiService('/agent/ask/stream', {
      user: req.user,
      body: input,
      requestId,
      signal: abortController.signal
    });
  } catch (error) {
    console.error('Error opening askAgentStream:', error);
    const translated = translateAiServiceError(error);
    if (translated.retryAfterMs) res.set('Retry-After', String(Math.ceil(translated.retryAfterMs / 1000)));
    return res.status(translated.status).json({ success: false, message: translated.message });
  }

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    // The connection to ai-service dropped mid-stream (not a provider error —
    // those already arrived as an in-band `error` event from ai-service
    // itself). Tell the browser and close, same contract as before.
    console.error('Error piping askAgentStream:', error);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'That did not go through. Try again in a moment.' })}\n\n`);
      res.end();
    }
  } finally {
    // ai-service persists the run itself (success or failure) before the
    // stream ends, so the cached budget figure is stale either way.
    invalidateBudget(req.user.id);
  }
};

// @desc    My conversations, newest activity first
// @route   GET /api/ai/conversations
// @access  Private
exports.listConversations = async (req, res, next) => {
  try {
    const db = getDb();
    const result = await db.execute(sql`
      SELECT conversation_id,
             (ARRAY_AGG(question ORDER BY created_at ASC))[1] AS title,
             MIN(created_at) AS started_at,
             MAX(created_at) AS last_at,
             COUNT(*)::int AS turns
      FROM ${agentRuns}
      WHERE user_id = ${req.user.id} AND answer <> ''
      GROUP BY conversation_id
      ORDER BY MAX(created_at) DESC
      LIMIT 50
    `);

    const data = result.rows.map((r) => ({
      id: r.conversation_id,
      title: String(r.title).slice(0, 120),
      startedAt: r.started_at,
      lastAt: r.last_at,
      turns: r.turns
    }));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// @desc    One of my conversations as the page renders it: user/assistant turns with traces
// @route   GET /api/ai/conversations/:id
// @access  Private (owner)
exports.getConversation = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ success: false, message: 'conversationId is not valid' });
    }
    const db = getDb();
    const runs = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.userId, req.user.id), eq(agentRuns.conversationId, req.params.id), ne(agentRuns.answer, '')))
      .orderBy(asc(agentRuns.createdAt));

    if (runs.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const stepsByRun = new Map();
    if (runs.length > 0) {
      const allSteps = await db
        .select()
        .from(agentRunSteps)
        .where(inArray(agentRunSteps.runId, runs.map((r) => r.id)))
        .orderBy(asc(agentRunSteps.iteration));
      for (const s of allSteps) {
        const key = String(s.runId);
        if (!stepsByRun.has(key)) stepsByRun.set(key, []);
        stepsByRun.get(key).push({ iteration: s.iteration, tool: s.tool, args: s.args, ok: s.ok, durationMs: s.durationMs, error: s.error || undefined });
      }
    }

    const messages = runs.flatMap((r) => [
      { role: 'user', content: r.question, at: r.createdAt },
      {
        role: 'assistant',
        content: r.answer,
        status: r.status,
        at: r.createdAt,
        trace: {
          steps: stepsByRun.get(String(r.id)) || [],
          iterations: r.iterations,
          durationMs: r.durationMs,
          llmMs: r.llmMs,
          usage: { promptTokens: r.promptTokens, completionTokens: r.completionTokens }
        }
      }
    ]);
    res.status(200).json({ success: true, data: { id: req.params.id, messages } });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete one of my conversations (all its runs)
// @route   DELETE /api/ai/conversations/:id
// @access  Private (owner)
exports.deleteConversation = async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ success: false, message: 'conversationId is not valid' });
    }
    const db = getDb();
    const deleted = await db
      .delete(agentRuns)
      .where(and(eq(agentRuns.userId, req.user.id), eq(agentRuns.conversationId, req.params.id)))
      .returning({ id: agentRuns.id });

    if (deleted.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
    invalidateBudget(req.user.id);
    res.status(200).json({ success: true, data: { deleted: deleted.length } });
  } catch (error) {
    next(error);
  }
};
