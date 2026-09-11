# Sankalp - Rural Education Management System

A comprehensive platform for managing volunteer-driven education programs in rural communities.

## Overview

Sankalp is a full-stack web application designed to coordinate weekend teaching volunteers, track student progress, and measure educational impact in rural villages. The platform streamlines event management, attendance tracking, and provides actionable analytics for program administrators.

## Features

### For Administrators
- **Dashboard**: Real-time overview of volunteers, students, and events
- **Event Management**: Create and manage weekend learning sessions with QR code check-in
- **Volunteer Management**: Track volunteer participation and attendance
- **Student Management**: Maintain student profiles and monitor progress
- **Analytics**: Visualize program impact with attendance trends and session metrics

### For Volunteers
- **QR Check-In**: Quick event check-in via QR code scanning
- **Session Logging**: Record teaching sessions with student attendance
- **Attendance History**: View personal participation records
- **Student Progress Tracking**: Monitor individual student development
- **RAG-Powered Teaching Notes Generator**: Create structured lesson plans grounded in curated teaching resources using Retrieval-Augmented Generation (RAG)
- **Ask Sankalp (AI agent)**: Ask questions in plain language — "what did I teach last time?", "which Class 4 students have we missed?" — answered by a tool-using agent over live club data, with a visible trace of every lookup it made
- **Session prep (AI workflow with human sign-off)**: Before a session, a fixed pipeline reads which children you taught, what they scored and who has been missed, picks 2–3 focus groups, grounds each in the resource library and drafts a hands-on block per group. You edit, approve or reject — nothing is final until you say so

## Tech Stack

**Frontend**
- React.js with React Router
- Tailwind CSS for styling
- Recharts for data visualization
- HTML5 QR code scanning

**Backend**
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT authentication
- bcrypt password hashing
- LLM integration via OpenAI-compatible APIs (Groq, Gemini or OpenAI — switchable by env var)

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd sankalps-village-project
```

2. **Configure environment variables**

Create a `.env` file in the `server` directory:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/sankalp-village-project
JWT_SECRET=your_secure_jwt_secret_key
CLIENT_URL=http://localhost:5173
# AI features (optional). Groq for chat, Gemini for embeddings is the free setup.
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
LLM_PROVIDER=groq
EMBEDDING_PROVIDER=gemini
```

3. **Install dependencies**

Backend:
```bash
cd server
npm install
```

Frontend:
```bash
cd ../client
npm install
```

4. **Seed the database**
```bash
cd server
npm run create-test-data   # Creates test volunteer accounts and students
npm run seed-resources     # Seeds teaching resources + embeddings for RAG (needs an embedding provider key)
```

This creates 15 test volunteer accounts and 15 students. Attendance sessions are created from the app (admin UI), and no admin account is seeded — see **Demo Credentials** below for how to get admin access.

5. **Start the application**

Backend (from `server` directory):
```bash
npm run dev
```

Frontend (from `client` directory, in a new terminal):
```bash
npm run dev
```

6. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Demo Credentials

**Volunteer Accounts** (created by `npm run create-test-data`)
- Email: `rahul.volunteer@gmail.com` (plus 14 more `<firstname>.volunteer@gmail.com` accounts)
- Password: `volunteer123` (all accounts)

**Admin access**
No admin account is seeded. Either:
- Sign in with Google using an email that starts with `23` or `24` (auto-assigned `admin`), or
- Promote an existing user: `cd server && npm run change-role <email> admin`

## Project Structure

```
sankalps-village-project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── context/       # Authentication context
│   │   └── utils/         # API utilities
│   └── package.json
│
├── server/                # Express backend
│   ├── models/           # Database models
│   ├── controllers/      # Business logic
│   ├── routes/           # API endpoints
│   ├── middleware/       # Auth & error handling
│   └── server.js         # Entry point
│
└── README.md
```

## API Documentation

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List all users (Admin)
- `POST /api/users` - Create new user (Admin)

### Events
- `GET /api/events` - List all events
- `POST /api/events` - Create event (Admin)
- `GET /api/events/:id` - Get event details

### Students
- `GET /api/students` - List all students
- `POST /api/students` - Add new student
- `GET /api/students/:id/progress` - Get student progress

### Sessions
- `GET /api/sessions` - List teaching sessions
- `POST /api/sessions` - Log new session

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/impact` - Impact metrics

### AI
- `POST /api/ai/ask` - Ask the tool-using agent (`{ messages: [{ role, content }] }`)
- `POST /api/prep/sessions/:id` - Draft (or return) my prep plan for a session (`{ force? }`)
- `GET /api/prep/sessions/:id`, `GET /api/prep/mine` - My plans
- `PATCH /api/prep/:id`, `POST /api/prep/:id/approve`, `POST /api/prep/:id/reject` - Review a draft (owner only)
- `POST/GET /api/prep/sessions/:id/all` - Draft for / list all registered volunteers (Admin)
- `POST /api/ai/generate-notes` - Generate lesson plan using RAG
- `GET /api/ai/resources` - List teaching resources
- `POST /api/ai/resources` - Create teaching resource (Admin)

## RAG-Powered Lesson Planning

This platform includes a Retrieval-Augmented Generation (RAG) system for creating grounded, source-backed lesson plans:

- **Curated Resource Library**: Admin-seeded teaching resources covering Math, Science, and English for Classes 3-5
- **Semantic Search**: Retrieves relevant teaching materials based on topic, subject, and grade
- **Source Attribution**: Shows volunteers which resources informed the generated lesson plan
- **Transparent AI**: Displays similarity scores and source snippets for full transparency

For technical details, see **[RAG_NOTES.md](RAG_NOTES.md)** - concise implementation overview optimized for technical interviews.

## Ask Sankalp — Tool-Using AI Agent

Beyond single-shot RAG, the platform includes an **agent** that answers free-form questions by calling tools over the live database:

- **Agent loop**: the model chooses which tools to call (and in what order); the server runs them, feeds results back, and repeats until the model answers — capped at 6 iterations
- **7 tools**, including the RAG retriever itself (`search_teaching_resources`), student progress, at-risk detection, sessions, the user's own teaching history, and volunteer statistics
- **Role-scoped tools**: volunteers are never shown admin tools; the server re-checks every call before executing it
- **Guardrails**: tool results are labelled as data (prompt-injection defence), per-tool timeouts, result truncation, transcript sanitising, no contact details ever reach the model
- **Full trace**: every run is persisted (`AgentRun`) with tool calls, arguments, latency and token usage; the UI shows what was looked up under each answer
- **Provider-agnostic**: chat and embeddings are routed through one `llmClient` layer; swapping Groq / Gemini / OpenAI is an env-var change. Embeddings are stamped with the model that produced them so vectors from different models are never compared
- **Resilient**: `Retry-After`-aware backoff on rate limits, per-tool timeouts, graceful step-limit answers

Implementation: `server/services/agentService.js` (loop), `server/services/agentTools.js` (registry), `client/src/pages/AskSankalp.jsx`.

## Session Prep — Workflow + Human-in-the-Loop

Where the agent lets the model choose its steps, session prep is a **fixed workflow**: the task is identical every weekend, so the steps are code and the model is only asked to judge.

```
gather context → plan focus groups (LLM, JSON) → retrieve resources (RAG) → write blocks (LLM, JSON) → DRAFT
                                                                         volunteer edits → approves / rejects
```

- **Structured outputs, validated**: every model reply is parsed against a zod schema; invented student names are dropped before anything is saved
- **Human-in-the-loop**: a draft becomes a plan only when the volunteer who will teach it approves; rejections carry a reason, kept for improving the planner
- **Idempotent and auditable**: re-running returns the existing draft; forcing a redraft supersedes rather than overwrites; each draft records its steps, timing and token usage
- **Proactive**: `npm run prep-next-session` drafts for every registered volunteer of the next session — the job a scheduler runs on Friday night

Implementation: `server/services/sessionPrepService.js`, `server/controllers/prepController.js`, `server/models/LessonPlanDraft.js`, `client/src/pages/SessionPrep.jsx`.

## Deployment

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For questions or support, please open an issue in the repository.

---

Built to empower volunteer educators in rural communities.
