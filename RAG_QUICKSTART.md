# RAG Feature Quick Start Guide

Get the RAG-powered lesson planning feature up and running in 5 minutes.

## Prerequisites

✅ MongoDB running (local or Atlas)  
✅ OpenAI API key (get one at https://platform.openai.com/api-keys)  
✅ Node.js installed (v16+)  

## Step 1: Configure OpenAI API Key

Add your OpenAI API key to `server/.env`:

```bash
# server/.env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note**: Keep this secret! Never commit it to version control.

## Step 2: Install Dependencies (if not already done)

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

## Step 3: Seed Teaching Resources

This is the key step! It creates and embeds 8 teaching resources:

```bash
cd server
npm run seed-resources
```

**Expected output:**
```
Connecting to database...
Clearing existing resources...

Processing and embedding resources (this may take a minute)...

Processing: Class 3 Math - Addition and Subtraction with Everyday Objects
  ✓ Created 2 chunks with embeddings
Processing: Class 4 Math - Introducing Fractions Using Rotis and Fruit
  ✓ Created 3 chunks with embeddings
Processing: Class 5 Math - Basic Shapes and Geometry Around the House
  ✓ Created 3 chunks with embeddings
Processing: Class 3 English - Phonics and Sounding Out Words
  ✓ Created 3 chunks with embeddings
Processing: Class 5 English - Building Reading Comprehension with Short Stories
  ✓ Created 4 chunks with embeddings
Processing: Class 4 Science - The Water Cycle Explained Simply
  ✓ Created 4 chunks with embeddings
Processing: Class 5 Science - Plants and Photosynthesis Basics
  ✓ Created 4 chunks with embeddings
Processing: General Teaching Tips - Running a Mixed-Age, One-Room Classroom
  ✓ Created 6 chunks with embeddings

✅ Successfully seeded resources!
Total resources: 8

Resources by subject:
  - Math: 3 resources (Classes 3, 4, 5)
  - English: 2 resources (Classes 3, 5)
  - Science: 2 resources (Classes 4, 5)
  - General Teaching: 1 resource (All classes)
```

> **What just happened?** Each resource was broken into chunks (~300 words each), and each chunk was embedded using OpenAI's `text-embedding-3-small` model. These embeddings enable semantic search during lesson plan generation.

## Step 4: Start the Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

## Step 5: Test the Feature

### Via UI

1. **Login** at http://localhost:5173
   - Email: `priya@sankalpvillage.org` (volunteer)
   - Password: `volunteer123`

2. **Navigate** to "Teaching Notes Generator" (AI icon in sidebar)

3. **Generate a lesson plan:**
   - **Topic**: `Fractions`
   - **Subject**: `Math`
   - **Grade**: `Class 4`
   - **Additional Instructions** (optional): `Focus on visual examples with food`
   - Click **Generate Notes**

4. **View results:**
   - See the generated lesson plan
   - Click **"📚 Grounded in N teaching resources"** to expand
   - Notice the source titles, snippets, and similarity scores (%)

5. **Try more examples:**
   - Topic: `Water Cycle`, Subject: `Science`, Grade: `Class 4`
   - Topic: `Phonics`, Subject: `English`, Grade: `Class 3`
   - Topic: `Photosynthesis`, Subject: `Science`, Grade: `Class 5`

### Via API (Using curl or Postman)

```bash
# First, login to get a token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@sankalpvillage.org","password":"volunteer123"}'

# Copy the token from the response, then:
curl -X POST http://localhost:5000/api/ai/generate-notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "topic": "Fractions",
    "subject": "Math",
    "grade": "Class 4",
    "extraInstructions": "Focus on visual examples"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "topic": "Fractions",
    "grade": "Class 4",
    "subject": "Math",
    "notes": "### Learning Objective\n\nBy the end of this lesson...",
    "sources": [
      {
        "type": "resource",
        "label": "Class 4 Math - Introducing Fractions Using Rotis and Fruit (Class 4 Math)",
        "snippet": "Fractions can be abstract, but using familiar food items makes them concrete and relatable...",
        "similarity": "0.892"
      }
    ],
    "generatedAt": "2026-08-21T18:45:00.000Z"
  }
}
```

## Step 6: Verify RAG is Working

### Good Test Cases (Should Retrieve Relevant Sources)

| Topic | Subject | Grade | Expected Source |
|-------|---------|-------|----------------|
| Fractions | Math | Class 4 | "Class 4 Math - Fractions" |
| Water Cycle | Science | Class 4 | "Class 4 Science - Water Cycle" |
| Phonics | English | Class 3 | "Class 3 English - Phonics" |
| Geometry | Math | Class 5 | "Class 5 Math - Geometry" |
| Photosynthesis | Science | Class 5 | "Class 5 Science - Plants" |

### Edge Case (No Matching Resources)

| Topic | Subject | Grade | Expected Behavior |
|-------|---------|-------|------------------|
| Quantum Physics | Science | Class 5 | No sources found, generates from general knowledge |

**How to verify:**
- Sources section should show 0 resources
- Lesson plan still generates (but isn't grounded in specific resources)
- No errors thrown

## Common Issues & Fixes

### Issue: "OPENAI_API_KEY not configured"
**Fix:** Add your API key to `server/.env` and restart the backend server.

### Issue: "No resources found for subject: X, grade: Y"
**Fix:** Run `npm run seed-resources` to populate the database with teaching resources.

### Issue: "Invalid OpenAI API key"
**Fix:** Check that your API key is correct and has credits available.

### Issue: Slow response times (>10 seconds)
**Possible causes:**
- OpenAI API is slow (check their status page)
- Large number of resources (not an issue with 8 resources)
- Network latency

### Issue: Sources showing 0% similarity
**Fix:** This shouldn't happen with the seed data. If it does:
1. Verify resources were seeded correctly: `npm run seed-resources`
2. Check MongoDB for resources: `db.resources.countDocuments()`
3. Verify embeddings exist in chunks

## Understanding the Output

### Similarity Scores

The percentage shown next to each source indicates semantic similarity:

- **90-100%**: Extremely relevant (exact topic match)
- **80-89%**: Very relevant (closely related)
- **75-79%**: Relevant (useful context)
- **Below 75%**: Filtered out (not shown)

### Source Snippets

The first ~150 characters of the retrieved chunk, so volunteers can see what content informed the lesson plan.

## Next Steps

### Add More Resources (as Admin)

```bash
curl -X POST http://localhost:5000/api/ai/resources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "title": "Class 3 Science - Animals and Their Habitats",
    "subject": "Science",
    "grade": "Class 3",
    "content": "Long-form teaching resource content here..."
  }'
```

The backend automatically chunks and embeds new resources!

### View All Resources

```bash
# All resources
curl http://localhost:5000/api/ai/resources \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filtered by subject and grade
curl "http://localhost:5000/api/ai/resources?subject=Math&grade=Class%204" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting Checklist

- [ ] MongoDB is running
- [ ] `OPENAI_API_KEY` is set in `server/.env`
- [ ] Resources are seeded (`npm run seed-resources`)
- [ ] Backend server is running on port 5000
- [ ] Frontend server is running on port 5173
- [ ] User is logged in (token in localStorage or cookies)
- [ ] OpenAI API has available credits

## What's Next?

✅ Feature is working!

Now you can:
- **Demo** the feature to stakeholders
- **Explain** the RAG implementation in interviews (see `RAG_NOTES.md`)
- **Extend** with more resources
- **Optimize** retrieval parameters (k, similarity threshold)

For in-depth technical details, see:
- `RAG_NOTES.md` - Interview prep guide
- `RAG_IMPLEMENTATION_SUMMARY.md` - Complete feature documentation
- `RAG_FLOW_DIAGRAM.md` - Visual data flow diagram

---

**Questions?** Check the logs in the server console for detailed retrieval information:
- Number of candidate chunks after metadata filtering
- Number of chunks returned (after similarity threshold)
- Query embeddings and similarity scores

Happy teaching! 🎓✨
