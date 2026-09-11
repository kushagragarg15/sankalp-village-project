const Resource = require('../models/Resource');
const { processResourceContent } = require('../services/embeddingService');
const { generateLessonPlan } = require('../services/ragService');
const { runAgent } = require('../services/agentService');
const { isConfigured, notConfiguredMessage, EMBEDDING_MODEL } = require('../services/llmClient');
const { invalidateBudget } = require('../middleware/aiBudget');

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
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'messages must be a non-empty array of { role, content }'
      });
    }

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'user' || typeof last.content !== 'string' || !last.content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'The last message must be a non-empty user message'
      });
    }

    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: notConfiguredMessage() });
    }

    const result = await runAgent({ messages, user: req.user });
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
      const outOfCredits = /credit|quota|billing/i.test(error.message);
      return res.status(429).json({
        success: false,
        message: outOfCredits
          ? 'The AI service has no credits left. Ask the coordinator to top up the provider account.'
          : 'LLM rate limit exceeded. Please try again later.'
      });
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
  const { messages } = req.body;
  const last = Array.isArray(messages) && messages[messages.length - 1];
  if (!last || last.role !== 'user' || typeof last.content !== 'string' || !last.content.trim()) {
    return res.status(400).json({ success: false, message: 'The last message must be a non-empty user message' });
  }
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
    const result = await runAgent({ messages, user: req.user, onEvent: send });
    invalidateBudget(req.user._id);
    send({ type: 'done', ...result });
  } catch (error) {
    console.error('Error in askAgentStream:', error);
    const message =
      error.status === 429 || /rate limit/i.test(error.message)
        ? 'The AI provider is rate-limiting us right now. Try again in a minute.'
        : 'That did not go through. Try again in a moment.';
    send({ type: 'error', message });
  } finally {
    if (!closed) res.end();
  }
};
