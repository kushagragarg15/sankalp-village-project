const OpenAI = require('openai');
const Resource = require('../models/Resource');
const { processResourceContent } = require('../services/embeddingService');
const { generateLessonPlan } = require('../services/ragService');
const { runAgent } = require('../services/agentService');

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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.'
      });
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
    if (error.message.includes('Invalid OpenAI API key')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OpenAI API key'
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        message: 'OpenAI API rate limit exceeded. Please try again later.'
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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.'
      });
    }

    // Process content: chunk and embed
    const chunks = await processResourceContent(content);

    // Create resource with embedded chunks
    const resource = await Resource.create({
      title,
      subject,
      grade,
      content,
      chunks,
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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.'
      });
    }

    const result = await runAgent({ messages, user: req.user });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in askAgent:', error);

    if (error.status === 401 || error.message.includes('Invalid OpenAI API key')) {
      return res.status(401).json({ success: false, message: 'Invalid OpenAI API key' });
    }
    // OpenAI answers 429 for both a burst limit and an empty balance; only one
    // of those is fixed by waiting.
    if (error.status === 429 || error.message.includes('rate limit')) {
      const outOfCredits = /credit|quota|billing/i.test(error.message);
      return res.status(429).json({
        success: false,
        message: outOfCredits
          ? 'The AI service has no credits left. Ask the coordinator to top up the OpenAI account.'
          : 'OpenAI API rate limit exceeded. Please try again later.'
      });
    }

    next(error);
  }
};
