const OpenAI = require('openai');

// @desc    Generate teaching notes using AI
// @route   POST /api/ai/generate-notes
// @access  Private
exports.generateTeachingNotes = async (req, res, next) => {
  try {
    const { topic, grade, subject } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.'
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `You are an experienced teacher creating a lesson plan for rural education volunteers. Generate a structured teaching outline for the following:

Topic: ${topic}
Grade/Class: ${grade || 'Not specified'}
Subject: ${subject || 'Not specified'}

Please provide:
1. Learning Objective (1-2 sentences)
2. Key Concepts (3-4 bullet points)
3. Simple Explanation (suitable for the grade level, in 2-3 paragraphs)
4. Activity Idea (one hands-on activity that requires minimal materials)
5. Three Quiz Questions (with answers)

Format the response in a clear, structured way that a volunteer can easily follow.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful teaching assistant creating lesson plans for rural education volunteers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const generatedNotes = completion.choices[0].message.content;

    res.status(200).json({
      success: true,
      data: {
        topic,
        grade,
        subject,
        notes: generatedNotes,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    // Handle OpenAI specific errors
    if (error.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid OpenAI API key'
      });
    }

    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'OpenAI API rate limit exceeded. Please try again later.'
      });
    }

    next(error);
  }
};
