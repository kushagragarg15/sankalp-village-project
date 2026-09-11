const Resource = require('../models/Resource');
const { processResourceContent } = require('../services/embeddingService');
const { generateLessonPlan } = require('../services/ragService');
const { runAgent } = require('../services/agentService');
const { isConfigured, notConfiguredMessage, EMBEDDING_MODEL } = require('../services/llmClient');
const { invalidateBudget } = require('../middleware/aiBudget');
const mongoose = require('mongoose');
const AgentRun = require('../models/AgentRun');

/**
 * Two accepted shapes for a question:
 *   { conversationId?, question }   — the server rebuilds history (preferred)
 *   { messages: [{ role, content }] } — a client-sent transcript (older clients)
 * A conversationId, when given, must be a valid id; ownership is enforced when
 * history is loaded (only this user's runs are read).
 */
/**
 * A 429 from the provider, in words a volunteer can act on. Distinguishes an
 * empty balance (waiting will not help) from a per-minute or per-day limit
 * (it will), and says how long when the provider told us.
 */
function providerBusyMessage(error) {
  const msg = error.message || '';
  if (/no credits|insufficient_quota|billing details/i.test(msg)) {
    return 'The AI service has no credits left. Ask the coordinator to top up the provider account.';
  }
  const secs = error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null;
  const when = !secs ? 'in a minute' : secs < 90 ? `in about ${secs} seconds` : `in about ${Math.ceil(secs / 60)} minutes`;
  const daily = /per day|TPD|RPD/i.test(msg) ? " The club's daily AI allowance with this provider is used up for now." : '';
  return `The AI provider is busy. Try again ${when}.${daily}`;
}

function parseAskBody(body = {}) {
  if (typeof body.question === 'string') {
    const question = body.question.trim();
    if (!question) return { error: 'question must not be empty' };
    if (body.conversationId !== undefined && body.conversationId !== null && body.conversationId !== '') {
      if (!mongoose.isValidObjectId(body.conversationId)) return { error: 'conversationId is not valid' };
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
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    if (!subject || !grade) {
      return res.status(400).json({
        success: false,
        message: 'Subject and grade are required'
      });
    }

    // Check if OpenAI API key is configured
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    // Generate lesson plan using RAG
    const result = await generateLessonPlan({
      topic,
      subject,
      grade,
      extraInstructions
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
    
    // Handle specific error messages from RAG service
    if (/Invalid .*API key/i.test(error.message)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key for the LLM provider'
      });
    }

    if (/rate limit/i.test(error.message)) {
      return res.status(429).json({
        success: false,
        message: 'LLM rate limit exceeded. Please try again later.'
      });
    }

    next(error);
  }
};

// @desc    Create a new teaching resource (admin only)
// @route   POST /api/ai/resources
// @access  Private (Admin)
exports.createResource = async (req, res, next) => {
  try {
    const { title, subject, grade, content } = req.body;

    if (!title || !subject || !grade || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, subject, grade, and content are required'
      });
    }

    // Check if OpenAI API key is configured
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    // Process content: chunk and embed
    const chunks = await processResourceContent(content);

    // Create resource with embedded chunks, recording which model produced them
    const resource = await Resource.create({
      title,
      subject,
      grade,
      content,
      chunks,
      embeddingModel: EMBEDDING_MODEL,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      data: resource
    });
  } catch (error) {
    console.error('Error creating resource:', error);
    next(error);
  }
};

// @desc    Get all teaching resources
// @route   GET /api/ai/resources
// @access  Private
exports.getResources = async (req, res, next) => {
  try {
    const { subject, grade } = req.query;
    
    const filter = {};
    if (subject) filter.subject = { $regex: new RegExp(subject, 'i') };
    if (grade) filter.grade = { $regex: new RegExp(grade, 'i') };

    const resources = await Resource.find(filter)
      .select('-chunks') // Don't return embeddings in list view
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: resources.length,
      data: resources
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    next(error);
  }
};

// @desc    Ask the tool-using agent a question about the club's data
// @route   POST /api/ai/ask
// @access  Private (tools are scoped to req.user.role inside the service)
exports.askAgent = async (req, res, next) => {
  try {
    const input = parseAskBody(req.body);
    if (input.error) return res.status(400).json({ success: false, message: input.error });

    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    const result = await runAgent({ ...input, user: req.user });
    invalidateBudget(req.user._id);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in askAgent:', error);

    if (error.status === 401 || /Invalid .*API key/i.test(error.message)) {
      return res.status(401).json({ success: false, message: 'Invalid API key for the LLM provider' });
    }
    // OpenAI answers 429 for both a burst limit and an empty balance; only one
    // of those is fixed by waiting.
    if (error.status === 429 || error.message.includes('rate limit')) {
      return res.status(429).json({ success: false, message: providerBusyMessage(error) });
    }

    next(error);
  }
};

// @desc    Ask the agent, streaming progress and the answer as Server-Sent Events
// @route   POST /api/ai/ask/stream
// @access  Private
//
// Events (one JSON object per `data:` line):
//   { type: 'token', text }              a piece of the answer
//   { type: 'retract' }                  discard the text so far (it was a tool turn)
//   { type: 'tool_start' | 'tool_end' }  progress, for the "looking up…" line
//   { type: 'done', ...result }          the same payload /ask returns
//   { type: 'error', message }
exports.askAgentStream = async (req, res, next) => {
  const input = parseAskBody(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  if (!isConfigured()) {
    return res.status(503).json({ success: false, message: notConfiguredMessage() });
  }

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // tell nginx-style proxies not to buffer
  });
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });
  const send = (event) => {
    if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const result = await runAgent({ ...input, user: req.user, onEvent: send });
    invalidateBudget(req.user._id);
    send({ type: 'done', ...result });
  } catch (error) {
    console.error('Error in askAgentStream:', error);
    const message =
      error.status === 429 || /rate limit/i.test(error.message)
        ? providerBusyMessage(error)
        : 'That did not go through. Try again in a moment.';
    send({ type: 'error', message });
  } finally {
    if (!closed) res.end();
  }
};

// @desc    My conversations, newest activity first
// @route   GET /api/ai/conversations
// @access  Private
exports.listConversations = async (req, res, next) => {
  try {
    // Only answered turns make a conversation; a question that hit a rate
    // limit or an error left nothing to come back to.
    const rows = await AgentRun.aggregate([
      { $match: { userId: req.user._id, conversationId: { $exists: true }, answer: { $ne: '' } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$conversationId',
          title: { $first: '$question' },
          startedAt: { $first: '$createdAt' },
          lastAt: { $last: '$createdAt' },
          turns: { $sum: 1 }
        }
      },
      { $sort: { lastAt: -1 } },
      { $limit: 50 }
    ]);
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((r) => ({ id: r._id, title: r.title.slice(0, 120), startedAt: r.startedAt, lastAt: r.lastAt, turns: r.turns }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    One of my conversations as the page renders it: user/assistant turns with traces
// @route   GET /api/ai/conversations/:id
// @access  Private (owner)
exports.getConversation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'conversationId is not valid' });
    }
    const runs = await AgentRun.find({ userId: req.user._id, conversationId: req.params.id, answer: { $ne: '' } })
      .sort({ createdAt: 1 })
      .select('question answer status iterations durationMs llmMs usage steps createdAt error')
      .lean();
    if (runs.length === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });

    const messages = runs.flatMap((r) => [
      { role: 'user', content: r.question, at: r.createdAt },
      {
        role: 'assistant',
        content: r.answer,
        status: r.status,
        at: r.createdAt,
        trace: {
          steps: (r.steps || []).map(({ resultPreview, ...s }) => s),
          iterations: r.iterations,
          durationMs: r.durationMs,
          llmMs: r.llmMs,
          usage: r.usage
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'conversationId is not valid' });
    }
    const { deletedCount } = await AgentRun.deleteMany({ userId: req.user._id, conversationId: req.params.id });
    if (deletedCount === 0) return res.status(404).json({ success: false, message: 'Conversation not found' });
    invalidateBudget(req.user._id);
    res.status(200).json({ success: true, data: { deleted: deletedCount } });
  } catch (error) {
    next(error);
  }
};
