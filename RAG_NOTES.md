# RAG-Powered Lesson Planning - Implementation Notes

## What is RAG and Why Use It?

**Retrieval-Augmented Generation (RAG)** is a technique that grounds AI-generated content in real, retrieved data instead of relying purely on the language model's training. Rather than having the LLM "imagine" a lesson plan from memory, we first retrieve the most relevant teaching resources from our library, then feed those into the prompt. This ensures generated lesson plans are based on proven teaching strategies and domain-specific knowledge, without requiring expensive fine-tuning or retraining of the model.

## Implementation Overview

This feature implements a "vanilla" RAG pipeline: **chunk → embed → retrieve → generate**.

### Data Flow

1. **Resource Ingestion** (`embeddingService.js`)
   - Admin-curated teaching resources are broken into chunks (~300 words with 50-word overlap)
   - Each chunk is embedded using OpenAI's `text-embedding-3-small` model
   - Chunks and their embeddings are stored in MongoDB (`Resource` model)

2. **Query Processing** (`ragService.js` → `retrieveContext()`)
   - When a volunteer requests a lesson plan (topic + subject + grade), we build a query string
   - The query is embedded using the same model for semantic consistency

3. **Metadata Pre-Filtering**
   - **Critical step**: Before any vector similarity computation, we filter resources by subject and grade in MongoDB
   - This narrows the candidate pool significantly and prevents irrelevant comparisons
   - Real production systems do this ahead of ANN (Approximate Nearest Neighbor) index lookups

4. **Similarity Search** (`cosineSimilarity()`)
   - For each candidate chunk, compute cosine similarity with the query embedding
   - Plain JavaScript implementation, no external libraries needed
   - Sort by similarity score, keep top-k chunks above a threshold (0.75 fixed cutoff for this project)

5. **Prompt Augmentation**
   - Build a grounded prompt: system message + retrieved chunks (with source labels) + user request
   - Each chunk is attributed to its source for transparency

6. **Generation** (`generateLessonPlan()`)
   - Send the augmented prompt to OpenAI chat completions (`gpt-4o-mini`)
   - Return both the generated lesson plan and the sources used

7. **Frontend Display** (`AITeachingNotes.jsx`)
   - Shows the generated lesson plan
   - Collapsible "Grounded in N sources" section with snippet previews and similarity scores
   - Visible provenance makes the RAG behavior demonstrable

### File and Function Reference

- **Models**: `server/models/Resource.js` - stores teaching resources with pre-computed embeddings
- **Services**:
  - `server/services/embeddingService.js` - `chunkText()`, `embedText()`, `processResourceContent()`
  - `server/services/ragService.js` - `cosineSimilarity()`, `retrieveContext()`, `generateLessonPlan()`
- **Controllers**: `server/controllers/aiController.js` - `generateTeachingNotes()`, `createResource()`, `getResources()`
- **Routes**: `server/routes/ai.js` - `/api/ai/generate-notes`, `/api/ai/resources`
- **Frontend**: `client/src/pages/AITeachingNotes.jsx` - volunteer-facing lesson plan generator UI
- **Seed Script**: `server/scripts/seedResources.js` - populates initial teaching resource library

## Elevator Pitch (Interview Version)

> "We implemented RAG for our lesson planning feature to make AI-generated teaching plans more reliable and grounded in real educational content. Instead of the model just 'making something up,' we first retrieve the most relevant chunks from our curated library of teaching resources—filtered by subject and grade, then ranked by semantic similarity using embeddings. Those chunks get injected into the prompt with source attribution, so the generated lesson plan is based on proven strategies. The volunteer sees exactly which resources were used, which builds trust. It's a standard chunk-embed-retrieve-generate pipeline, implemented with OpenAI embeddings and MongoDB, designed to be fully explainable in an interview setting."

## Glossary

**Embedding**: A dense vector representation (array of numbers) of text that captures its semantic meaning. Texts with similar meanings have similar embeddings. We use OpenAI's `text-embedding-3-small` (1536 dimensions).

**Cosine Similarity**: A measure of similarity between two vectors based on the cosine of the angle between them. Returns a value between -1 and 1 (we see 0 to 1 in practice). Higher = more similar. Formula: `dot(a,b) / (||a|| * ||b||)`.

**Chunking**: Breaking long documents into smaller, overlapping pieces. Ensures each piece is semantically cohesive and fits within embedding and generation context limits. We use word-count-based splitting (300 words, 50-word overlap).

**Top-k Retrieval**: After scoring all candidates by similarity, select the k most similar chunks. We use k=5 by default—balancing context richness with prompt length.

**Prompt Augmentation / Grounding**: Inserting retrieved context into the prompt given to the LLM. This "grounds" the generation in real data. The model generates *from* the provided material, not just from its training.

**Metadata Pre-Filtering**: Narrowing the candidate set by structured attributes (subject, grade) before semantic search. Critical for performance and relevance—prevents full collection scans and irrelevant comparisons. Production systems do this before ANN index queries.

## What Has Been Added Since (2026-09)

- **Provider-agnostic LLM layer** (`services/llmClient.js`): chat and embeddings chosen by env var (Groq / Gemini / OpenAI) through OpenAI-compatible endpoints; embeddings stamped with their model so vectors from different models are never compared.
- **Hybrid search** (`services/lexicalSearch.js`): BM25 over the pre-filtered chunks, fused with vector ranking by weighted RRF. Available via `RETRIEVAL_MODE=hybrid`; not the default, because the evals show no gain on this library.
- **Evals** (`evals/`): golden set + retrieval metrics (precision/recall@k, MRR, hit@1, false positives) and generation metrics (structure checks + LLM judge). Runs persisted and diffed. The threshold in the section above (0.75) is the OpenAI-era value; for Gemini embeddings it is 0.62, and the eval is what established that.
- **RAG as an agent tool** and **as a workflow step**: see `services/agentTools.js` and `services/sessionPrepService.js`.

## What Would a Production System Still Add?

A production deployment would add:

1. **Vector Database / ANN Index**: Use Pinecone, Weaviate, or MongoDB Atlas Vector Search for efficient similarity search at scale. Our current in-memory cosine similarity works for small datasets (~10-100 resources) but doesn't scale to thousands.

2. **Reranking**: After initial retrieval, use a cross-encoder model to rerank results. More computationally expensive but significantly improves relevance at the top positions.

3. **A bigger, human-labelled eval set** with inter-annotator agreement, and a judge model that is not the generator.

4. **Caching & Rate Limiting**: Cache embeddings for common queries; per-user budgets on top of the retry/backoff that exists now.

5. **Streaming Responses**: Stream generated text to the frontend for better UX on long generations.

These are all legitimate production concerns, deliberately out of scope here—this is a student project optimized for clarity and interview discussion, not a research system.

---

## Running the Feature

### Prerequisites
- `OPENAI_API_KEY` configured in `server/.env`
- MongoDB connection established

### Seed Teaching Resources
```bash
cd server
npm run seed-resources
```

This processes and embeds 8 sample teaching resources covering Math, English, and Science for Classes 3-5, plus general teaching tips.

### Generate a Lesson Plan
1. Log in as a volunteer
2. Navigate to "Teaching Notes Generator"
3. Enter: Topic (e.g., "Fractions"), Subject, Grade
4. Click "Generate Notes"
5. View the generated plan and expand "Grounded in N sources" to see which resources were used

### API Endpoints
- `POST /api/ai/generate-notes` - Generate RAG-powered lesson plan
  - Body: `{ topic, subject, grade, extraInstructions? }`
  - Returns: `{ lessonPlan, sources: [{ label, snippet, similarity }] }`
- `GET /api/ai/resources` - List all teaching resources (optional filters: `?subject=Math&grade=Class%205`)
- `POST /api/ai/resources` - Create new resource (admin only)
  - Body: `{ title, subject, grade, content }`
  - Automatically chunks and embeds content

---

**Key Takeaway**: This is a straightforward, production-inspired RAG implementation that trades advanced techniques for simplicity and explainability—perfect for technical interviews and portfolio demonstrations.
