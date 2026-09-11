const { getEmbeddingClient, EMBEDDING_MODEL } = require('./llmClient');

/**
 * Simple word-count-based text chunking with overlap.
 * For production, consider semantic chunking or sentence-aware splitting.
 * 
 * @param {string} text - The text to chunk
 * @param {object} options - Chunking options
 * @param {number} options.maxWords - Maximum words per chunk (default: 300)
 * @param {number} options.overlapWords - Overlap between chunks (default: 50)
 * @returns {string[]} Array of text chunks
 */
function chunkText(text, { maxWords = 300, overlapWords = 50 } = {}) {
  // Skip chunking for short texts
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return [text];
  }

  const chunks = [];
  let startIdx = 0;

  while (startIdx < words.length) {
    const endIdx = Math.min(startIdx + maxWords, words.length);
    const chunk = words.slice(startIdx, endIdx).join(' ');
    chunks.push(chunk);

    // Move forward by (maxWords - overlapWords) to create overlap
    startIdx += (maxWords - overlapWords);
    
    // Avoid infinite loop for edge cases
    if (startIdx >= words.length) break;
  }

  return chunks;
}

/**
 * Generate an embedding with the active provider's embedding model
 * (see llmClient.js). Callers that store the result must also store
 * EMBEDDING_MODEL next to it — vectors from different models are not comparable.
 * 
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} The embedding vector
 */
async function embedText(text) {
  const client = getEmbeddingClient();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Process a resource: chunk its content and generate embeddings for each chunk.
 * 
 * @param {string} content - The resource content to process
 * @param {object} options - Chunking options
 * @returns {Promise<Array<{text: string, embedding: number[]}>>} Array of chunks with embeddings
 */
async function processResourceContent(content, options = {}) {
  const chunks = chunkText(content, options);
  
  const processedChunks = [];
  for (const chunkText of chunks) {
    const embedding = await embedText(chunkText);
    processedChunks.push({
      text: chunkText,
      embedding
    });
  }

  return processedChunks;
}

module.exports = {
  chunkText,
  embedText,
  processResourceContent,
  EMBEDDING_MODEL
};
