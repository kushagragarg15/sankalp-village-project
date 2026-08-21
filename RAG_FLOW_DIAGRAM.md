# RAG Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RESOURCE INGESTION (One-time)                   │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  Admin Adds  │
│  Resource    │
│  (Content)   │
└──────┬───────┘
       │
       ▼
┌─────────────────────────┐
│  embeddingService.js    │
│  ├─ chunkText()         │  Breaks content into ~300 word chunks
│  │  (300 words, 50     │  with 50 word overlap
│  │   word overlap)      │
│  └─ embedText()         │  Calls OpenAI text-embedding-3-small
│     (OpenAI API)        │  Returns 1536-dim vector per chunk
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  MongoDB Resource       │
│  {                      │
│    title: "..."         │
│    subject: "Math"      │
│    grade: "Class 4"     │
│    chunks: [            │
│      {                  │
│        text: "...",     │  Stored for retrieval
│        embedding: [...]  │  (1536 floats per chunk)
│      }                  │
│    ]                    │
│  }                      │
└─────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                 LESSON PLAN GENERATION (Runtime)                    │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Volunteer       │
│  Requests Plan   │
│  {               │
│    topic: "Fractions"
│    subject: "Math"
│    grade: "Class 4"
│  }               │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────┐
│  ragService.js → retrieveContext() │
└────────────────────────────────────┘
         │
         ├─────────────────────────────────────────┐
         │ STEP 1: Metadata Pre-Filter            │
         │                                         │
         │  Query MongoDB:                         │
         │  db.resources.find({                    │
         │    subject: /Math/i,    ◄─────────┐    │
         │    grade: /Class 4/i              │    │
         │  })                               │    │
         │                                   │    │
         │  Why? Narrows candidate pool     │    │
         │  before vector search            │    │
         │  (prevents full collection scan) │    │
         └──────────┬──────────────────────┬┘    │
                    │                       │     │
                    ▼                       │     │
         ┌─────────────────────┐           │     │
         │ Matching Resources  │◄──────────┘     │
         │ • Class 4 Math -    │  Only 2-3       │
         │   Fractions         │  resources      │
         │ • Class 3 Math -    │  remain         │
         │   Addition          │  (efficient!)   │
         └──────────┬──────────┘                 │
                    │                            │
         ├──────────────────────────────────────┤
         │ STEP 2: Embed Query                  │
         │                                       │
         │  queryText = "Fractions Math Class 4"│
         │  queryEmbedding = embedText(query)   │
         │    → [0.023, -0.156, 0.891, ...]     │
         │       (1536 dimensions)               │
         └──────────┬───────────────────────────┘
                    │
         ├──────────────────────────────────────┤
         │ STEP 3: Score with Cosine Similarity │
         │                                       │
         │  For each chunk in matching resources:│
         │                                       │
         │  similarity = cosineSimilarity(      │
         │    queryEmbedding,                   │
         │    chunk.embedding                   │
         │  )                                    │
         │                                       │
         │  Result (sorted by similarity):      │
         │  ┌─────────────────────────────┐     │
         │  │ Chunk from "Fractions"      │     │
         │  │ similarity: 0.923 ✓         │     │
         │  ├─────────────────────────────┤     │
         │  │ Chunk from "Fractions"      │     │
         │  │ similarity: 0.887 ✓         │     │
         │  ├─────────────────────────────┤     │
         │  │ Chunk from "Geometry"       │     │
         │  │ similarity: 0.782 ✓         │     │
         │  ├─────────────────────────────┤     │
         │  │ Chunk from "Addition"       │     │
         │  │ similarity: 0.654 ✗         │  Below threshold
         │  └─────────────────────────────┘  (0.75), rejected
         └──────────┬───────────────────────────┘
                    │
         ├──────────────────────────────────────┤
         │ STEP 4: Keep Top-K (k=5)             │
         │                                       │
         │  Select top 5 chunks with            │
         │  similarity >= 0.75                  │
         │                                       │
         │  Retrieved Context: 3 chunks         │
         └──────────┬───────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│  ragService.js → generateLessonPlan()  │
└────────────────────────────────────────┘
         │
         ├──────────────────────────────────────┐
         │ STEP 5: Build Augmented Prompt      │
         │                                       │
         │  System Message:                     │
         │  "You are an experienced teacher..." │
         │                                       │
         │  Retrieved Context:                  │
         │  [Resource 1: Class 4 Math - Fractions]
         │  "Fractions can be abstract, but..." │
         │                                       │
         │  [Resource 2: Class 4 Math - Fractions]
         │  "Use rotis to demonstrate halves..."│
         │                                       │
         │  [Resource 3: Class 5 Math - Geometry]
         │  "Visual representations help..."    │
         │                                       │
         │  User Request:                       │
         │  "Create a lesson plan for:          │
         │   Topic: Fractions                   │
         │   Subject: Math                      │
         │   Grade: Class 4"                    │
         └──────────┬───────────────────────────┘
                    │
         ├──────────────────────────────────────┤
         │ STEP 6: Generate with OpenAI         │
         │                                       │
         │  Model: gpt-4o-mini                  │
         │  Temperature: 0.7                    │
         │  Max Tokens: 1500                    │
         │                                       │
         │  → LLM reads the retrieved chunks    │
         │     and generates grounded plan      │
         └──────────┬───────────────────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Generated Lesson Plan   │
         │  + Source Attribution    │
         │                          │
         │  {                       │
         │    lessonPlan: "...",    │
         │    sources: [            │
         │      {                   │
         │        label: "Class 4  │
         │                Math..."  │
         │        snippet: "...",   │
         │        similarity: 0.923 │
         │      }                   │
         │    ]                     │
         │  }                       │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Frontend Display        │
         │  ─────────────────────   │
         │  Generated Plan:         │
         │  [Full lesson plan text] │
         │                          │
         │  📚 Grounded in 3        │
         │     teaching resources   │
         │  ▶ [Click to expand]     │
         │                          │
         │  When expanded:          │
         │  ┌────────────────────┐  │
         │  │ Class 4 Math -     │  │
         │  │ Fractions (92%)    │  │
         │  │ "Fractions can..." │  │
         │  └────────────────────┘  │
         └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                          KEY CONCEPTS                               │
└─────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════╗
║  Metadata Pre-Filtering                                            ║
║  ───────────────────────                                           ║
║  Filter by subject/grade BEFORE vector search                      ║
║  • Reduces search space from thousands to dozens                   ║
║  • Ensures topical relevance                                       ║
║  • Much faster than brute-force similarity on all chunks           ║
║  • Real systems do this before ANN index lookups                   ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║  Cosine Similarity                                                 ║
║  ─────────────────                                                 ║
║  Measures angle between two vectors                                ║
║  • 1.0 = identical direction (very similar)                        ║
║  • 0.0 = orthogonal (unrelated)                                    ║
║  • We use threshold of 0.75 (arbitrary but reasonable)            ║
║                                                                    ║
║  Formula: dot(a,b) / (||a|| * ||b||)                              ║
║           ─────────────────────────                               ║
║           √(Σa²) × √(Σb²)                                         ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║  Chunking with Overlap                                             ║
║  ─────────────────────                                             ║
║  Break long docs into smaller pieces for better matching           ║
║  • 300 words per chunk (fits in embedding context)                 ║
║  • 50-word overlap (preserves context across boundaries)           ║
║  • Short docs stay whole (no need to split)                        ║
║                                                                    ║
║  [────────chunk 1────────]                                         ║
║                  [────────chunk 2────────]                         ║
║                           └─overlap─┘                              ║
╚════════════════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════════════════╗
║  Why RAG vs Fine-Tuning?                                           ║
║  ──────────────────────                                            ║
║  ✓ Add new knowledge without retraining                            ║
║  ✓ Transparent sourcing (see what grounded the response)           ║
║  ✓ Update library dynamically (admins add resources)               ║
║  ✓ Much cheaper than fine-tuning                                   ║
║  ✓ Works with any LLM (not model-specific)                         ║
╚════════════════════════════════════════════════════════════════════╝
```

## Performance Characteristics

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Metadata Filter | O(n) with index | Fast: indexed on `{subject, grade}` |
| Embedding Query | O(1) | Single API call, ~100-200ms |
| Cosine Similarity | O(k × d) | k=candidates (~10-30), d=1536 dims |
| Top-K Selection | O(k log k) | Sort candidates, typically ~30 chunks |
| Generation | O(1) | Single OpenAI API call, ~2-5s |

**Total latency**: ~3-6 seconds end-to-end

## Scaling Considerations

| Dataset Size | Current Approach | Production Approach |
|--------------|-----------------|---------------------|
| < 100 resources | ✅ In-memory cosine similarity | Same (works fine) |
| 100-1000 resources | ⚠️ Slower but workable | Add vector index (MongoDB Atlas) |
| > 1000 resources | ❌ Too slow | Dedicated vector DB (Pinecone, Weaviate) |

Current implementation optimized for **demonstration and interviews**, not large-scale production.
