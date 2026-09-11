const { CHAT_MODEL, EMBEDDING_MODEL, SIMILARITY_THRESHOLD, chatWithRetry } = require('./llmClient');
const Resource = require('../models/Resource');
const { embedText } = require('./embeddingService');

/**
 * Calculate cosine similarity between two vectors.
 * Plain JavaScript implementation - no external libraries needed.
 * 
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(a, b) {
  // Different lengths means different embedding models; the number would be noise.
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Regexes matching the requested class, its neighbours, and "All".
 * "Class 5" -> [/Class 4/i, /Class 5/i, /Class 6/i, /^All$/i]. Falls back to the
 * literal grade when it has no number in it.
 */
function nearbyGradePatterns(grade) {
  const n = parseInt(String(grade).match(/\d+/)?.[0], 10);
  if (Number.isNaN(n)) return [new RegExp(grade, 'i'), /^All$/i];
  return [n - 1, n, n + 1]
    .filter((g) => g >= 1)
    .map((g) => new RegExp(`^Class ${g}$`, 'i'))
    .concat(/^All$/i);
}

/**
 * Retrieve relevant context chunks from the resource library.
 * 
 * This implements metadata pre-filtering before vector similarity search:
 * - First: narrow candidates by subject/grade (metadata filter)
 * - Then: embed the query and rank by cosine similarity
 * - Finally: return top-k chunks above a similarity threshold
 * 
 * Metadata pre-filtering is critical for performance and relevance - it prevents
 * a full collection scan and ensures we only compare semantically within the
 * right educational context. Production systems do this before ANN index lookups.
 * 
 * @param {object} params - Retrieval parameters
 * @param {string} params.topic - The lesson topic
 * @param {string} params.subject - The subject (Math, Science, etc.)
 * @param {string} params.grade - The grade/class level
 * @param {number} params.k - Number of top chunks to retrieve (default: 5)
 * @param {number} params.minSimilarity - Minimum similarity threshold (default: the
 *   embedding model's SIMILARITY_THRESHOLD from llmClient)
 * @returns {Promise<Array<{text: string, similarity: number, source: object}>>}
 */
async function retrieveContext({ topic, subject, grade, k = 5, minSimilarity = SIMILARITY_THRESHOLD }) {
  try {
    // Step 1: Metadata pre-filter - only get resources matching subject and grade
    // This prevents comparing irrelevant documents and is much faster than
    // scanning all chunks in the collection.
    //
    // Grade is matched loosely: the requested class plus one either side, and
    // resources marked "All". A Class 4 fractions guide is exactly what a
    // volunteer teaching fractions to Class 5 needs, and with a library this
    // small an exact match excludes most of it.
    // Only resources embedded with the model we will embed the query with.
    // Resources seeded before the field existed came from text-embedding-3-small.
    const embeddedWith =
      EMBEDDING_MODEL === 'text-embedding-3-small' ? { $in: [EMBEDDING_MODEL, null] } : EMBEDDING_MODEL;

    const matchingResources = await Resource.find({
      subject: { $regex: new RegExp(subject, 'i') },
      grade: { $in: nearbyGradePatterns(grade) },
      embeddingModel: embeddedWith
    }).select('title subject grade chunks');

    if (matchingResources.length === 0) {
      console.log(`No resources found for subject: ${subject}, grade: ${grade}`);
      return [];
    }

    // Step 2: Build query string and generate its embedding
    const queryText = `${topic} ${subject} ${grade}`;
    const queryEmbedding = await embedText(queryText);

    // Step 3: Collect all candidate chunks from matching resources
    const candidates = [];
    for (const resource of matchingResources) {
      for (const chunk of resource.chunks) {
        candidates.push({
          text: chunk.text,
          embedding: chunk.embedding,
          source: {
            title: resource.title,
            subject: resource.subject,
            grade: resource.grade
          }
        });
      }
    }

    console.log(`Found ${candidates.length} candidate chunks after metadata filtering`);

    // Step 4: Score all candidates with cosine similarity
    const scoredCandidates = candidates.map(candidate => ({
      text: candidate.text,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
      source: candidate.source
    }));

    // Step 5: Sort by similarity (descending) and filter by threshold
    const topChunks = scoredCandidates
      .filter(c => c.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    console.log(`Returning ${topChunks.length} chunks (threshold: ${minSimilarity}, k: ${k})`);
    
    return topChunks;
  } catch (error) {
    console.error('Error in retrieveContext:', error);
    throw new Error(`Context retrieval failed: ${error.message}`);
  }
}

/**
 * Generate a lesson plan using RAG: retrieve relevant chunks, then generate.
 * 
 * This is the core RAG flow:
 * 1. Retrieve relevant teaching resource chunks (grounding material)
 * 2. Build a prompt that includes those chunks with source attribution
 * 3. Generate the lesson plan from that grounded prompt
 * 4. Return both the plan and the sources used
 * 
 * @param {object} params - Generation parameters
 * @param {string} params.topic - The lesson topic
 * @param {string} params.subject - The subject
 * @param {string} params.grade - The grade/class level
 * @param {string} params.extraInstructions - Optional additional instructions
 * @param {number} params.k - Number of context chunks to retrieve
 * @returns {Promise<{lessonPlan: string, sources: Array}>}
 */
async function generateLessonPlan({ topic, subject, grade, extraInstructions = '', k = 5 }) {
  try {
    // Step 1: Retrieve relevant context chunks
    const retrievedChunks = await retrieveContext({ topic, subject, grade, k });

    // Step 2: Build the grounded prompt with source attribution
    let contextSection = '';
    if (retrievedChunks.length > 0) {
      contextSection = '\n\nRELEVANT TEACHING RESOURCES:\n\n';
      retrievedChunks.forEach((chunk, idx) => {
        contextSection += `[Resource ${idx + 1}: ${chunk.source.title}]\n`;
        contextSection += `${chunk.text}\n\n`;
      });
    } else {
      contextSection = '\n\nNote: No specific teaching resources found for this exact topic. Generate from general teaching knowledge.\n\n';
    }

    const systemMessage = `You are an experienced teacher helping volunteers plan lessons for rural classrooms with limited materials. Use the provided teaching resources to ground your lesson plan in proven teaching strategies.`;

    const userPrompt = `${contextSection}
Based on the teaching resources above, create a structured lesson plan for:

Topic: ${topic}
Subject: ${subject}
Grade: ${grade}
${extraInstructions ? `Additional Instructions: ${extraInstructions}\n` : ''}
Please provide:
1. Learning Objective (1-2 sentences)
2. Key Concepts (3-4 bullet points)
3. Simple Explanation (suitable for the grade level, in 2-3 paragraphs)
4. Activity Idea (one hands-on activity that requires minimal materials)
5. Three Quiz Questions (with answers)

Format the response in a clear, structured way that a volunteer can easily follow.`;

    // Step 3: Call the chat model of whichever provider is configured
    const completion = await chatWithRetry({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const lessonPlan = completion.choices[0].message.content;

    // Step 4: Prepare source information for display
    const sources = retrievedChunks.map((chunk, idx) => ({
      type: 'resource',
      label: `${chunk.source.title} (${chunk.source.grade} ${chunk.source.subject})`,
      snippet: chunk.text.substring(0, 150) + (chunk.text.length > 150 ? '...' : ''),
      similarity: chunk.similarity.toFixed(3)
    }));

    return {
      lessonPlan,
      sources
    };
  } catch (error) {
    console.error('Error generating lesson plan:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 401) {
      throw new Error('Invalid API key for the LLM provider');
    }
    if (error.status === 429) {
      throw new Error(`LLM rate limit exceeded: ${error.message}`);
    }
    
    throw new Error(`Lesson plan generation failed: ${error.message}`);
  }
}

module.exports = {
  cosineSimilarity,
  retrieveContext,
  generateLessonPlan
};
