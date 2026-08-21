# RAG Implementation Summary

## ✅ Core Implementation Complete

A complete Retrieval-Augmented Generation (RAG) system has been added to the Sankalp teaching platform, upgrading the existing "Teaching Notes Generator" from basic LLM generation to grounded, source-backed lesson planning.

---

## 🎯 What Was Built

### Backend Components

#### 1. **Resource Model** (`server/models/Resource.js`)
- Stores curated teaching resources with metadata (title, subject, grade, content)
- Pre-computed chunks with embeddings for efficient retrieval
- MongoDB indexes on subject/grade for fast metadata filtering

#### 2. **Embedding Service** (`server/services/embeddingService.js`)
- `chunkText()`: Word-count-based chunking with overlap (300 words, 50-word overlap)
- `embedText()`: OpenAI `text-embedding-3-small` integration
- `processResourceContent()`: Complete pipeline from raw content to embedded chunks

#### 3. **RAG Service** (`server/services/ragService.js`)
- `cosineSimilarity()`: Plain JavaScript vector similarity (no external libs)
- `retrieveContext()`: 
  - Metadata pre-filtering by subject/grade
  - Query embedding generation
  - Similarity scoring and top-k retrieval (k=5, threshold=0.75)
- `generateLessonPlan()`:
  - Context retrieval
  - Prompt augmentation with source attribution
  - OpenAI `gpt-4o-mini` generation
  - Returns plan + sources

#### 4. **Controller Updates** (`server/controllers/aiController.js`)
- **Upgraded** `generateTeachingNotes()` to use RAG pipeline
- **New** `createResource()` - admin endpoint to add teaching resources
- **New** `getResources()` - list/filter resources

#### 5. **Route Updates** (`server/routes/ai.js`)
- `POST /api/ai/generate-notes` - now RAG-powered
- `GET /api/ai/resources` - list resources
- `POST /api/ai/resources` - create resource (admin-only)

#### 6. **Seed Script** (`server/scripts/seedResources.js`)
- Populates 8 sample teaching resources:
  - **Math**: Class 3 (addition/subtraction), Class 4 (fractions), Class 5 (geometry)
  - **English**: Class 3 (phonics), Class 5 (reading comprehension)
  - **Science**: Class 4 (water cycle), Class 5 (photosynthesis)
  - **General**: Teaching tips for mixed-age classrooms
- Run with: `npm run seed-resources`

### Frontend Components

#### 7. **Enhanced UI** (`client/src/pages/AITeachingNotes.jsx`)
- **Added** "Additional Instructions" textarea for custom guidance
- **Added** collapsible "Grounded in N sources" section showing:
  - Source title and metadata
  - Snippet preview (150 chars)
  - Similarity score percentage
- **Updated** state management for source visibility toggle
- **Updated** generation metadata footer to show RAG sourcing

### Documentation

#### 8. **Interview Prep Notes** (`RAG_NOTES.md`)
Complete technical documentation including:
- What RAG is and why it's used
- Full data flow with file/function references
- Elevator pitch for interviews
- Glossary (embeddings, cosine similarity, chunking, etc.)
- Production enhancements discussion (vector DB, hybrid search, reranking)

---

## 🔄 Data Flow (End-to-End)

```
1. Admin seeds resources
   ↓ (seedResources.js)
2. Content is chunked & embedded
   ↓ (embeddingService.js)
3. Chunks stored in MongoDB with embeddings
   ↓ (Resource model)
4. Volunteer requests lesson plan
   ↓ (AITeachingNotes.jsx → POST /api/ai/generate-notes)
5. Query embedded & metadata pre-filter applied
   ↓ (ragService.js → retrieveContext)
6. Top-k similar chunks retrieved
   ↓ (cosineSimilarity scoring)
7. Prompt built with retrieved chunks + sources
   ↓ (generateLessonPlan)
8. OpenAI generates grounded lesson plan
   ↓ (gpt-4o-mini)
9. Plan + sources returned to UI
   ↓
10. Volunteer sees plan with source attribution
```

---

## 📋 Field Name Mappings (Matched Existing Conventions)

✅ Student model uses **`grade`** (not `class` or `standard`) - matched in Resource model  
✅ Session notes stored in **TeachingLog** model (fields: `subject`, `topic`)  
✅ Routes follow `/api/{resource}/{action}` pattern  
✅ Controllers use `exports.functionName` format  
✅ Frontend uses Tailwind classes matching existing design system  

---

## 🚀 How to Use

### Setup
1. Ensure `OPENAI_API_KEY` is set in `server/.env`
2. MongoDB connection working
3. Run seed script:
```bash
cd server
npm run seed-resources
```

### Generate a Lesson Plan
1. Login as volunteer
2. Navigate to "Teaching Notes Generator"
3. Enter:
   - **Topic**: e.g., "Fractions"
   - **Subject**: Math
   - **Grade**: Class 4
   - **Additional Instructions** (optional): e.g., "Focus on visual examples"
4. Click "Generate Notes"
5. View plan and expand "📚 Grounded in N teaching resources" to see sources

### API Usage
```javascript
// Generate lesson plan
POST /api/ai/generate-notes
Body: {
  topic: "Fractions",
  subject: "Math",
  grade: "Class 4",
  extraInstructions: "Include visual examples" // optional
}

Response: {
  success: true,
  data: {
    topic: "Fractions",
    grade: "Class 4",
    subject: "Math",
    notes: "...", // generated lesson plan
    sources: [
      {
        type: "resource",
        label: "Class 4 Math - Introducing Fractions Using Rotis and Fruit (Class 4 Math)",
        snippet: "Fractions can be abstract, but using familiar food items makes them concrete and relatable...",
        similarity: "0.892"
      }
    ],
    generatedAt: "2026-08-21T18:45:00.000Z"
  }
}

// List resources (with optional filters)
GET /api/ai/resources?subject=Math&grade=Class%204

// Create resource (admin only)
POST /api/ai/resources
Body: {
  title: "Class 3 Science - Animals and Habitats",
  subject: "Science",
  grade: "Class 3",
  content: "..." // full resource content (will be auto-chunked & embedded)
}
```

---

## 🎓 Interview Talking Points

### The Problem
"Our teaching notes generator used pure LLM generation, which could 'hallucinate' or provide generic advice not specific to rural, low-resource classrooms."

### The Solution
"We implemented RAG to ground generation in curated teaching resources. When a volunteer requests a plan, we retrieve the most relevant chunks from our library using semantic search, then inject those into the prompt with source attribution."

### Technical Highlights
- **Metadata pre-filtering** before vector search (efficient, prevents irrelevant comparisons)
- **Plain JS cosine similarity** (no black-box libraries, fully explainable)
- **Source transparency** in UI (builds trust, demonstrates RAG behavior)
- **OpenAI embeddings** (industry-standard, consistent representation)
- **Chunking with overlap** (preserves context across boundaries)

### Trade-offs Acknowledged
"This is a vanilla RAG pipeline optimized for clarity. Production systems would add vector databases for scale, hybrid search for precision, and reranking for quality—but those add complexity. For a student project and interview discussion, this implementation strikes the right balance."

---

## ✨ Key Differentiators

1. **Actually working RAG** - Not just a demo or mock; real retrieval, real embeddings, real generation
2. **Visible provenance** - Sources shown in UI with snippets and similarity scores
3. **Well-documented** - Every key decision explained in code comments
4. **Interview-ready** - RAG_NOTES.md provides talking points and glossary
5. **Extensible** - Admin can add new resources via API (future: UI for resource management)

---

## 🔮 Optional Stretch Goals (Not Implemented - Future Work)

These were listed in the spec as stretch goals but kept out of scope for Core:

- [ ] **Session Notes Retrieval**: Add embedding field to TeachingLog model, retrieve from past volunteer notes alongside resources
- [ ] **Admin UI for Resources**: Visual interface to add/edit/delete resources (currently seed-script only)
- [ ] **Tunable Parameters**: Expose `k` and `minSimilarity` as query params for experimentation

**Why not included?**: Core RAG pipeline is complete and demonstrable. These additions would be great next iterations but aren't needed to explain and showcase the RAG concept in interviews.

---

## 📊 Testing the Implementation

### Verification Steps (Before Calling it Done)

1. **Seed Resources**:
   ```bash
   cd server
   npm run seed-resources
   ```
   - ✅ Confirm 8 resources created with chunks and embeddings

2. **Test Retrieval**:
   - Request: Topic="Fractions", Subject="Math", Grade="Class 4"
   - Expected: Should retrieve the "Class 4 Math - Fractions" resource with high similarity
   - ✅ Verify sources returned are topically relevant

3. **Test Metadata Filtering**:
   - Request: Topic="Water", Subject="Science", Grade="Class 4"
   - Expected: Should retrieve "Class 4 Science - Water Cycle"
   - Should NOT retrieve Math or English resources
   - ✅ Verify filtering works correctly

4. **Test Edge Cases**:
   - Request topic with no matching resources (e.g., "Quantum Physics")
   - Expected: Gracefully generate without sources, indicate no specific resources found
   - ✅ Verify error handling

5. **UI Verification**:
   - Generate a plan
   - ✅ Verify sources section displays correctly
   - ✅ Verify collapsible behavior works
   - ✅ Verify similarity scores shown as percentages
   - ✅ Verify copy button still works

---

## 🎯 Success Criteria Met

✅ Resource model created with chunks and embeddings  
✅ Embedding service with chunking and OpenAI integration  
✅ RAG service with cosine similarity, retrieval, and generation  
✅ Upgraded existing endpoint to use RAG pipeline  
✅ Admin endpoints for resource management  
✅ Frontend displays sources with provenance  
✅ Seed script with 8 diverse teaching resources  
✅ Comprehensive interview-prep documentation  
✅ No diagnostics errors  
✅ Follows existing code conventions  

---

## 🎉 Result

The Sankalp platform now features a production-inspired, interview-ready RAG implementation that:
- Grounds lesson plans in real teaching resources
- Shows volunteers exactly which sources informed the plan
- Can be extended with more resources over time
- Demonstrates understanding of modern AI system architecture
- Is fully explainable in technical interviews

**Ready for demo and deployment!**
