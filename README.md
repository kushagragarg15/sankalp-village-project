# Sankalp — Rural Education Management System

A full-stack platform for a student club that runs weekend teaching sessions for children in a village school. It coordinates volunteers, records who taught whom (verified by a rotating code and a geofence), tracks each child's progress, and puts an AI assistant, a RAG lesson planner and a human-in-the-loop session-prep workflow on top of that data.

Three services, one PostgreSQL database:

| Service | Stack | Responsibility |
|---|---|---|
| `client/` | React 18, Vite, Tailwind, Recharts | The single-page app volunteers and coordinators use |
| `server/` | Node.js, Express, Drizzle ORM, `pg` | Auth, attendance, students, analytics, AI guardrails, session-prep workflow, MCP server, evals |
| `ai-service/` | Python, FastAPI, LangGraph, LangChain, asyncpg | RAG (embed / retrieve / generate / ingest) and the tool-using agent |
| database | PostgreSQL + `pgvector` | Every table below, including the embedding vectors |

---

## Contents

- [Features](#features)
- [System architecture](#system-architecture)
- [Data model](#data-model)
- [Authentication and roles](#authentication-and-roles)
- [Attendance flow](#attendance-flow)
- [AI features](#ai-features)
  - [Ask Sankalp — the LangGraph agent](#ask-sankalp--the-langgraph-agent)
  - [RAG lesson planner](#rag-lesson-planner)
  - [Session prep — workflow with human sign-off](#session-prep--workflow-with-human-sign-off)
  - [Guardrails and observability](#guardrails-and-observability)
  - [MCP server](#mcp-server)
  - [Evals](#evals)
- [Frontend structure](#frontend-structure)
- [Getting started](#getting-started)
  - [Run with Docker](#run-with-docker)
- [Testing](#testing)
- [Logging and metrics](#logging-and-metrics)
- [Configuration reference](#configuration-reference)
- [API reference](#api-reference)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Migration notes](#migration-notes)
- [License](#license)

---

## Features

### For coordinators (admin)
- **Today** — live sessions, who is registered, the current attendance code
- **Sessions** — create weekend sessions with a time window and an optional location; the 4-digit attendance code rotates every 10 minutes while a session is live
- **Attendance report** — every teaching log across the club, per session and per volunteer
- **Volunteers** — the member list; a *super admin* can additionally promote or demote coordinators
- **Students** — profiles, quiz scores, who taught each child and when
- **Insights** — lessons per day, subjects, most active volunteers, most-taught children
- **AI activity** — every question put to the assistant and what it looked up, tool failure rates, token spend per person against the daily budget, why volunteers rejected drafted plans, and eval trends
- **Prep for everyone** — draft a session plan for every registered volunteer of a session in one go

### For volunteers
- **Register** for an upcoming session, then **record attendance** during it: enter the code read out in the room, allow location, tick the children taught and what was covered
- **My record** — personal teaching history
- **Lesson planner** — a structured lesson plan for a topic, grade and subject, grounded in the club's own resource library (RAG) with the sources shown
- **Ask** — plain-language questions over live club data ("which Class 4 children have we missed?", "what did I teach last time?") answered by a tool-using agent, streamed as it works, with a visible trace of every lookup; conversations are kept per person and resumable
- **Session prep** — before a session, a fixed pipeline reads which children you taught, what they scored and who has been missed, picks 2–3 focus groups, grounds each in the resource library and drafts a hands-on block per group. You edit, approve or reject — nothing is final until you say so

---

## System architecture

```mermaid
flowchart LR
    subgraph Browser
        SPA["React SPA<br/>(client/)"]
    end

    subgraph Node["Node.js API — server/ :5000"]
        MW["protect / authorize<br/>JWT → req.user (cached 15s)"]
        Guard["aiRateLimit + aiDailyBudget"]
        Ctl["Controllers<br/>auth · sessions · registrations<br/>teaching-logs · students · users<br/>analytics · ai · prep"]
        Prep["sessionPrepService<br/>(fixed workflow)"]
        MCP["mcp/server.js<br/>(stdio, Model Context Protocol)"]
        Evals["evals/<br/>retrieval · generation"]
        Tools["agentTools.js<br/>(7 tools, Node copy)"]
        LLMn["llmClient.js<br/>provider table + retry"]
    end

    subgraph Py["Python AI service — ai-service/ :8000"]
        IA["require_internal_auth<br/>shared token + X-Sankalp-User-*"]
        RAG["/rag<br/>embed · retrieve · lesson-plan · resources"]
        AG["/agent<br/>ask · ask/stream"]
        Graph["LangGraph<br/>agent ⇄ tools"]
        PTools["app/tools<br/>(7 tools, LangChain)"]
        LLMp["ChatOpenAI / OpenAIEmbeddings<br/>(Groq · Gemini · OpenAI)"]
    end

    PG[("PostgreSQL + pgvector")]
    Prov["LLM providers<br/>Groq · Gemini · OpenAI"]
    Client2["Claude Desktop / Claude Code<br/>(any MCP client)"]

    SPA -- "REST + SSE /api/*" --> MW --> Ctl
    Ctl --> Guard
    Ctl -- "Drizzle ORM" --> PG
    Ctl -- "aiServiceClient.js<br/>Bearer AI_SERVICE_TOKEN" --> IA
    Prep --> Tools --> PG
    Prep --> LLMn --> Prov
    Prep -- "/rag/retrieve" --> IA
    MCP --> Tools
    Evals -- "/rag/*" --> IA
    IA --> RAG
    IA --> AG --> Graph --> PTools
    RAG -- "asyncpg, pgvector cosine" --> PG
    PTools -- "asyncpg" --> PG
    Graph --> LLMp --> Prov
    RAG --> LLMp
    Client2 -- "stdio" --> MCP
```

**Design points**

- **One database, two drivers.** Node uses Drizzle ORM over `pg`; Python uses `asyncpg`. Both read and write the same tables; vector search happens only in Python (`app/rag/retriever.py`) so there is exactly one similarity implementation.
- **The browser never talks to Python.** Node resolves the JWT into a trusted `{ id, role, name }`, then forwards that under a shared secret (`AI_SERVICE_TOKEN`) in `X-Sankalp-User-*` headers with an `X-Request-Id` for cross-service tracing. Python never re-derives a role from a token it can see.
- **Guardrails live in one place.** Rate limiting and the per-user daily token budget are Express middleware in front of every token-spending route; `ai-service` does not re-implement them.
- **Streaming is pass-through.** `POST /api/ai/ask/stream` opens an SSE connection to `ai-service` and pipes the bytes to the browser; the answer is never assembled in Node.
- **The tool registry exists twice, on purpose.** `ai-service/app/tools` is the authoritative implementation used by the agent. `server/services/agentTools.js` is the Node copy still used by the session-prep workflow and the MCP server; both return identically shaped data. New tool logic belongs in Python.

### Request path for a typical API call

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express
    participant A as protect()
    participant C as Controller
    participant D as PostgreSQL

    B->>E: GET /api/students (Authorization: Bearer jwt)
    E->>A: verify JWT
    A->>A: user cache hit? (15 s TTL)
    alt miss
        A->>D: SELECT id,name,email,role,phone,is_super_admin
        D-->>A: row
    end
    A-->>E: req.user
    E->>C: authorize(role)?
    C->>D: Drizzle query
    D-->>C: rows
    C-->>B: { success, data }
```

### Request path for an AI call (Node → Python)

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as Node (aiController)
    participant G as aiRateLimit / aiDailyBudget
    participant P as ai-service (FastAPI)
    participant L as LLM provider
    participant D as PostgreSQL

    B->>N: POST /api/ai/ask/stream { conversationId?, question }
    N->>G: per-user sliding window (12 / 5 min)
    G->>D: SUM(tokens) today from agent_runs + lesson_plan_drafts
    G-->>N: under budget (X-AI-Tokens-Used-Today header)
    N->>P: POST /agent/ask/stream<br/>Bearer AI_SERVICE_TOKEN + X-Sankalp-User-{Id,Role,Name} + X-Request-Id
    P->>P: require_internal_auth (constant-time compare)
    P->>D: load conversation history (last 12 msgs)
    loop LangGraph: agent → tools → agent (≤ 6)
        P->>L: chat completion with role-scoped tools (streamed)
        P-->>N: data: {type:"token"|"retract"|"tool_start"|"tool_end"}
        N-->>B: piped verbatim
        P->>D: run tool queries (≤ 12 s each, concurrent)
    end
    P->>D: INSERT agent_runs + agent_run_steps
    P-->>N: data: {type:"done", answer, steps, usage, runId}
    N-->>B: piped verbatim, budget cache invalidated
```

---

## Data model

All tables live in PostgreSQL and are declared in `server/db/schema.js` (Drizzle). Migrations are in `server/db/migrations/` and applied with `npm run db:migrate`.

```mermaid
erDiagram
    users {
        uuid id PK
        text name
        text email UK
        text password_hash "nullable - Google-only accounts"
        text google_id UK
        text role "admin | volunteer"
        boolean is_super_admin
        text phone
    }
    students {
        uuid id PK
        text name
        text grade
        int grade_number "parsed once from grade"
        timestamptz enrollment_date
        text parent_phone "never sent to the model"
    }
    quiz_scores {
        uuid id PK
        uuid student_id FK
        text subject
        text topic
        numeric score
        numeric max_score
        timestamptz taken_at
    }
    attendance_sessions {
        uuid id PK
        text title
        timestamptz start_time
        timestamptz end_time
        text active_code "4 digits, rotates every 10 min"
        timestamptz code_expiry
        float lat
        float lng
        uuid created_by FK
    }
    registrations {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
    }
    teaching_logs {
        uuid id PK
        uuid volunteer_id FK
        uuid session_id FK
        uuid student_id FK
        text subject
        text topic
        text code_used
        float lat
        float lng
        timestamptz logged_at
    }
    resources {
        uuid id PK
        text title
        text subject
        text grade
        int grade_number
        text content
        text embedding_model
        uuid created_by FK
    }
    resource_chunks {
        uuid id PK
        uuid resource_id FK
        int chunk_index
        text text
        vector embedding "vector(3072)"
        text embedding_model
    }
    agent_runs {
        uuid id PK
        uuid user_id FK
        uuid conversation_id
        text role
        text question
        text answer
        text status "completed | max_iterations | error"
        text model
        int iterations
        int duration_ms
        int llm_ms
        int prompt_tokens
        int completion_tokens
    }
    agent_run_steps {
        uuid id PK
        uuid run_id FK
        int iteration
        text tool
        jsonb args
        boolean ok
        int duration_ms
        text result_preview
        text error
    }
    lesson_plan_drafts {
        uuid id PK
        uuid session_id FK
        uuid volunteer_id FK
        text status "draft | approved | rejected | superseded"
        jsonb focus_groups
        text review_note
        boolean edited_by_volunteer
        jsonb context_summary
        jsonb trace
        int prompt_tokens
        int completion_tokens
        text provider
        text model
    }
    eval_runs {
        uuid id PK
        text kind "retrieval | generation"
        jsonb config
        jsonb metrics
        jsonb per_query
        text note
    }

    users ||--o{ registrations : "registers"
    users ||--o{ teaching_logs : "logs as volunteer"
    users ||--o{ attendance_sessions : "creates"
    users ||--o{ agent_runs : "asks"
    users ||--o{ lesson_plan_drafts : "reviews"
    users ||--o{ resources : "adds"
    students ||--o{ quiz_scores : "has"
    students ||--o{ teaching_logs : "taught in"
    attendance_sessions ||--o{ registrations : "has"
    attendance_sessions ||--o{ teaching_logs : "records"
    attendance_sessions ||--o{ lesson_plan_drafts : "prepared for"
    resources ||--o{ resource_chunks : "split into"
    agent_runs ||--o{ agent_run_steps : "traces"
```

**Constraints worth knowing**

- `teaching_logs (session_id, volunteer_id, student_id)` is unique — a child cannot be logged twice by the same volunteer in one session; bulk inserts use `ON CONFLICT DO NOTHING` and report the duplicate count.
- `registrations (user_id, session_id)` is unique.
- `resource_chunks.embedding` is `vector(3072)` (gemini-embedding-001). No ANN index: pgvector's HNSW/IVFFlat cap at 2000 dims for the plain `vector` type, and at the current library size an exact scan is fast and deterministic.
- `embedding_model` is stamped on every resource and chunk; retrieval only reads chunks embedded by the model currently configured, so vectors from different models are never compared.
- `users.role` is checked `IN ('admin','volunteer')`; `is_super_admin` is a flag on top of `admin`, not a third role, so every existing `authorize('admin')` route keeps working.

### Backend module map

```mermaid
classDiagram
    direction LR

    class protect {
        +userCache: Map (15 s TTL)
        +protect(req, res, next)
        +authorize(...roles)
        +invalidateUser(id)
    }
    class aiBudget {
        +aiRateLimit(req, res, next)
        +aiDailyBudget(req, res, next)
        +tokensSpentToday(userId)
        +invalidateBudget(userId)
    }
    class aiController {
        +generateTeachingNotes()
        +askAgent()
        +askAgentStream()
        +listConversations()
        +getConversation()
        +deleteConversation()
        +createResource()
        +getResources()
    }
    class prepController {
        +prepareForSession()
        +editDraft()
        +approveDraft()
        +rejectDraft()
        +prepareAllForSession()
    }
    class aiServiceClient {
        +callAiService(path, opts)
        +streamAiService(path, opts)
        +translateAiServiceError(err)
        +SYSTEM_USER
    }
    class ragService {
        +retrieveContext(params)
        +generateLessonPlan(params)
    }
    class sessionPrepService {
        +prepareForSession(session, volunteer, opts)
        -gatherContext()
        -planFocus()
        -retrieveForGroups()
        -writeBlocks()
    }
    class agentTools {
        +tools: Tool[7]
        +toolsForRole(role)
        +normaliseSubject(s)
    }
    class llmClient {
        +CHAT_PROVIDER, CHAT_MODEL
        +EMBEDDING_PROVIDER, EMBEDDING_MODEL
        +chatWithRetry(params)
        +isConfigured()
    }
    class mcpServer {
        +MCP_USER_EMAIL
        +tools (from agentTools)
        +resource sankalp://whoami
        +prompt prepare_for_next_session
    }

    aiController --> aiBudget
    aiController --> aiServiceClient
    prepController --> aiBudget
    prepController --> sessionPrepService
    sessionPrepService --> agentTools
    sessionPrepService --> llmClient
    sessionPrepService --> ragService
    ragService --> aiServiceClient
    agentTools --> ragService
    mcpServer --> agentTools
    mcpServer --> llmClient
```

```mermaid
classDiagram
    direction LR

    class InternalUser {
        +id: str
        +role: admin | volunteer
        +name: str
    }
    class require_internal_auth {
        +Bearer AI_SERVICE_TOKEN
        +X-Sankalp-User-Id / Role / Name
        +returns InternalUser
    }
    class ResolvedLLMConfig {
        +chat_provider
        +embedding_provider
        +chat_model
        +embedding_model
        +similarity_threshold
    }
    class ProviderError {
        +code: rate_limited | no_credits | provider_error
        +retry_after_ms
        +to_dict()
    }
    class retriever {
        +retrieve_context(pool, topic, subject, grade, ...)
        +PgVectorResourceRetriever (BaseRetriever)
        -_fetch_candidates()
        -_rank_hybrid()
    }
    class generation {
        +generate_lesson_plan(topic, subject, grade, ...)
    }
    class ingest {
        +ingest_resource(pool, title, subject, grade, content)
    }
    class chunking {
        +chunk_text(text, 300, 50)
    }
    class AgentState {
        +messages: list[BaseMessage]
        +iterations: int
        +steps: list[dict]
        +prompt_tokens / completion_tokens
        +llm_ms
        +status
    }
    class graph {
        +agent_node(state, config)
        +tools_node(state, config)
        +route_after_agent(state)
        +AGENT_GRAPH
    }
    class runner {
        +run_agent(question, conversation_id, user, on_event)
        +run_agent_stream(...)
    }
    class tools {
        +tools_for_user(role, user_id, user_name)
        +search_teaching_resources
        +draft_lesson_plan
        +get_student_progress
        +find_students_needing_attention
        +list_sessions
        +get_my_teaching_history
        +get_volunteer_stats (admin)
    }

    require_internal_auth --> InternalUser
    runner --> graph
    runner --> tools
    runner --> InternalUser
    graph --> AgentState
    graph --> ProviderError
    generation --> retriever
    generation --> ResolvedLLMConfig
    ingest --> chunking
    tools --> retriever
    tools --> generation
```

---

## Authentication and roles

```mermaid
flowchart TD
    A[Login page] -->|email + password| B["POST /api/auth/login<br/>bcrypt compare"]
    A -->|Google ID token| C["POST /api/auth/google<br/>google-auth-library verifyIdToken"]
    C --> C1{"email verified and<br/>matches ALLOWED_EMAIL_DOMAIN?"}
    C1 -->|no| X[401 / 403]
    C1 -->|yes, new email| C2["INSERT user<br/>role = volunteer"]
    C1 -->|yes, existing| C3["link google_id<br/>role untouched"]
    B --> T
    C2 --> T
    C3 --> T
    T["JWT (30 d) — set as httpOnly cookie<br/>and returned in the body"]
    T --> S[SPA stores token in localStorage<br/>sends Authorization: Bearer]
    S --> P["protect() on every /api route"]
    P --> R{authorize role?}
    R -->|admin| ADM[coordinator screens]
    R -->|volunteer| VOL[volunteer screens]
    ADM --> SA{is_super_admin?}
    SA -->|yes| RM[may change roles / create admins]
    SA -->|no| RO[may edit members, not roles]
```

Rules the code enforces:

- **Signing in never changes a role.** A new Google account starts as `volunteer`; an existing account linked to Google keeps whatever role it had.
- **Admin is granted explicitly** — by a super admin in the Volunteers page, or by `npm run change-role <email> admin`.
- **Only a super admin may change roles or create an admin account.** A regular admin can edit a member's name/email/phone. Nobody can demote themselves. The super-admin flag is set directly in the database (`UPDATE users SET is_super_admin = true WHERE email = '…'`).
- `protect()` caches the projected user for 15 s (`USER_CACHE_TTL_MS`) to avoid a round trip on every request; role changes and deletions invalidate the cache entry.
- Every session-code, geofence and registration check happens **server-side**; the UI only mirrors the result.

---

## Attendance flow

Sankalp teaches on Saturday and Sunday mornings. A session is a time window; a volunteer proves presence with a short-lived code read out in the room and a location check.

```mermaid
sequenceDiagram
    actor Co as Coordinator
    participant API as Node API
    actor V as Volunteer
    participant DB as PostgreSQL

    Co->>API: POST /attendance-sessions { title, startTime, endTime, location? }
    API->>DB: INSERT attendance_sessions
    V->>API: POST /registrations/register { sessionId }
    API->>DB: INSERT registrations (unique per user+session)

    Note over API: Session window opens
    Co->>API: GET /attendance-sessions (Today page polls every 30 s)
    API->>API: live session with no valid code? → mint 4-digit code, 10-min expiry
    API->>DB: UPDATE active_code, code_expiry (one statement for all stale sessions)
    API-->>Co: sessions incl. code + expiry (admins only)
    API-->>V: sessions without the code
    Co->>V: reads the code aloud in the room

    V->>API: POST /teaching-logs/submit { session_id, code, lat, lng, entries[] }
    API->>DB: session + registration (parallel)
    API->>API: now within window? registered? code matches? not expired?
    API->>API: Haversine(lat,lng → session or SCHOOL_LAT/LNG) ≤ ATTENDANCE_RADIUS_M?
    API->>DB: INSERT teaching_logs … ON CONFLICT DO NOTHING
    API-->>V: { created, duplicates }
```

Session states as the client sees them (`client/src/utils/session.js`):

```mermaid
stateDiagram-v2
    [*] --> upcoming : created by a coordinator
    upcoming --> live : now ≥ start_time
    live --> live : code rotates every 10 min
    live --> ended : now > end_time
    ended --> [*]

    note right of upcoming : volunteers may register
    note right of live : attendance accepted with valid code + location
    note right of ended : registration and attendance refused
```

Registration is refused once a session has ended; attendance is refused outside the window; a request without coordinates is refused rather than let through unchecked.

---

## AI features

> New to agents, tools or RAG? **[AI_AGENTS_GUIDE.md](AI_AGENTS_GUIDE.md)** explains every AI feature below from first principles, with worked examples and a step-by-step guide to adding a tool.

Provider selection is one env var. Every provider speaks the OpenAI wire format, so both Node (`openai` SDK) and Python (`langchain-openai`) use a single client with a different `base_url`:

| `LLM_PROVIDER` | Chat model | Embeddings | Notes |
|---|---|---|---|
| `groq` (default) | `openai/gpt-oss-120b` | — | free, fast, good tool use |
| `gemini` | `gemini-3.5-flash` | `gemini-embedding-001` (3072-d), threshold 0.62 | free tier is a demo budget, not a dev one |
| `openai` | `gpt-4o-mini` | `text-embedding-3-small`, threshold 0.75 | paid |

Chat and embeddings are chosen separately (`EMBEDDING_PROVIDER`), because the cheapest chat model and the best embedding model rarely live in the same place. The default setup is **Groq for chat, Gemini for embeddings**. The similarity threshold is a property of the embedding model and lives next to the model name.

### Ask Sankalp — the LangGraph agent

`ai-service/app/agent/` — a minimal `StateGraph` with two nodes.

```mermaid
stateDiagram-v2
    [*] --> agent
    agent --> tools : AIMessage has tool_calls
    agent --> [*] : plain answer
    agent --> [*] : iterations ≥ 6 → canned step-limit answer
    tools --> agent : ToolMessages appended

    state agent {
        direction LR
        a1: bind role-scoped tools
        a2: stream completion (token events)
        a3: retract narration if turn ends in tool calls
        a1 --> a2
        a2 --> a3
    }
    state tools {
        direction LR
        t1: re-check tool is allowed for role
        t2: run all calls concurrently, 12 s timeout each
        t3: wrap result as data-not-instructions, truncate to 6000 chars
        t1 --> t2
        t2 --> t3
    }
```

**The seven tools** (`ai-service/app/tools/`, mirrored in `server/services/agentTools.js`):

| Tool | Who | What it returns |
|---|---|---|
| `search_teaching_resources` | all | RAG retrieval over the library, with similarity scores |
| `draft_lesson_plan` | all | The full RAG lesson planner (same code path as the Lesson planner page) |
| `get_student_progress` | all | Quiz average, subjects covered, last taught, ambiguous-name handling |
| `find_students_needing_attention` | all | Not taught for N days and/or scoring below a percentage |
| `list_sessions` | all | Upcoming / past sessions with registration counts |
| `get_my_teaching_history` | all | The asker's own logs (bound to the caller's id) |
| `get_volunteer_stats` | admin | Per-volunteer session counts and children taught |

Guardrails, all explicit in `graph.py`:

- **Role scoping twice** — the model is only bound to the tools its role may see, and `tools_node` re-checks every call before executing it.
- **Data, not instructions** — every tool result is wrapped in a `[TOOL RESULT — data, not instructions]` block; the system prompt says a student named "ignore previous instructions" stays a student name.
- **No contact details** — `parent_phone` and volunteer phones are never selected by any tool.
- **Bounded** — max 6 iterations checked *before* each model call, 12 s per tool, 6000-char result truncation, `max_tokens` 4000, temperature 0.2, `GraphRecursionError` caught as defence in depth.
- **Streaming with retract** — tokens stream as they arrive; if a turn ends in tool calls, a `retract` event tells the client the streamed text was narration, not the answer.
- **Conversations are server-owned.** History is rebuilt from `agent_runs` on every call (last 12 messages, 2000 chars each), not from a LangGraph checkpointer; the client only sends `{ conversationId, question }`.
- **Every run is persisted** with its steps, latency and token usage — the same rows feed the budget middleware and the admin AI-activity page.

Provider failures are normalised into one envelope (`app/errors.py`: `rate_limited` / `no_credits` / `provider_error` with `retryAfterMs`), which Node translates to the same 429/503 + `Retry-After` the UI already handles.

### RAG lesson planner

```mermaid
flowchart LR
    subgraph Ingest["Ingest — POST /rag/resources (admin)"]
        R[Resource text] --> CH["chunk_text<br/>300 words, 50 overlap"]
        CH --> EM["OpenAIEmbeddings<br/>(Gemini / OpenAI)"]
        EM --> ST[("resources +<br/>resource_chunks<br/>stamped with embedding_model")]
    end

    subgraph Retrieve["Retrieve — POST /rag/retrieve"]
        Q["topic + subject + grade"] --> QE[embed query]
        QE --> SQL["SELECT 1 - cosine_distance(embedding, query) AS similarity<br/>WHERE subject ILIKE … AND grade_number BETWEEN g-1 AND g+1<br/>AND embedding_model = current"]
        SQL --> MODE{RETRIEVAL_MODE}
        MODE -->|vector| GATE[similarity ≥ threshold, top k]
        MODE -->|hybrid| BM["BM25 over candidates<br/>→ RRF (weights 1 : 0.5)<br/>→ threshold with keyword rescue"]
    end

    subgraph Generate["Generate — POST /rag/lesson-plan"]
        GATE --> PR[prompt with numbered sources]
        BM --> PR
        PR --> LLM["ChatOpenAI, temp 0.7<br/>retry on 429/5xx with provider's wait"]
        LLM --> OUT["Objective · Key concepts · Explanation ·<br/>Activity (no printed materials) · 3 quiz Qs<br/>+ sources with similarity"]
    end

    ST -.-> SQL
```

- Similarity is computed **inside PostgreSQL** by pgvector's `<=>` operator; the embedding column never leaves the database.
- The chunker is a deliberate word-count port of the original, not `RecursiveCharacterTextSplitter` — changing chunk boundaries would invalidate every stored vector and the eval expectations.
- `PgVectorResourceRetriever` wraps the same query as a LangChain `BaseRetriever`; it is not `langchain_postgres.PGVector`, which would impose its own table shape and mean a second search implementation.
- The Lesson planner page, the `draft_lesson_plan` tool and the generation eval all call this one endpoint, so the same input yields the same plan everywhere.

### Session prep — workflow with human sign-off

Where the agent lets the model choose its steps, session prep is a **fixed workflow** (`server/services/sessionPrepService.js`): the task is identical every weekend, so the steps are code and the model is only asked to judge.

```mermaid
flowchart LR
    G["gather<br/>get_my_teaching_history +<br/>find_students_needing_attention<br/>(agent tools as plain functions)"]
    P["plan focus groups<br/>LLM, JSON mode<br/>validated with zod<br/>≤ 3 groups, ≤ 8 names each"]
    V["drop invented<br/>student names"]
    R["retrieve resources<br/>per group via /rag/retrieve"]
    W["write blocks<br/>LLM, JSON mode, zod<br/>objective · activity · 2–4 check questions"]
    D[("lesson_plan_drafts<br/>status = draft<br/>+ trace, tokens, timing")]
    G --> P --> V --> R --> W --> D
```

```mermaid
stateDiagram-v2
    [*] --> draft : POST prep for session (idempotent — returns the existing draft)
    draft --> draft : PATCH — volunteer edits (edited_by_volunteer = true)
    draft --> approved : approve
    draft --> rejected : reject with a reason
    draft --> superseded : forced re-draft
    rejected --> superseded : re-draft
    superseded --> [*]
    approved --> [*]
```

- Each model reply is parsed against a zod schema, with one retry that feeds the validation error back.
- A draft becomes a plan only when the volunteer who will teach it approves. Rejections require a reason, which the AI-activity page surfaces so the planner can be improved.
- Coordinators can draft for every registered volunteer of a session (`POST /prep/sessions/:id/all`) and see review status, but cannot approve on a volunteer's behalf.
- `npm run prep-next-session` is the batch job a scheduler runs on Friday night.

### Guardrails and observability

`server/middleware/aiBudget.js` sits in front of `/ai/generate-notes`, `/ai/ask`, `/ai/ask/stream` and `POST /prep/sessions/:id`:

| Guardrail | Default | Env var |
|---|---|---|
| Requests per user, sliding window | 12 per 5 min | `AI_RATE_LIMIT_REQUESTS`, `AI_RATE_LIMIT_WINDOW_MS` |
| Tokens per user per day | 150 000 | `AI_DAILY_TOKEN_BUDGET_PER_USER` |

The budget is computed from the audit rows (`agent_runs` + `lesson_plan_drafts`), cached 30 s, so it survives restarts and shows the same numbers on the admin page. Both answer `429` with `Retry-After`; admins are not exempt because the provider quota is shared. Responses carry `X-AI-Tokens-Used-Today` and `X-AI-Tokens-Budget`.

`GET /api/ai/admin/activity` aggregates, for the last 7 days: runs and status breakdown, per-tool call counts / failure rate / average latency, token spend per person today, recent questions with their tools, prep reviews by status with rejection reasons, and the last retrieval/generation eval runs — plus the live provider/model/threshold/budget configuration.

### MCP server

`server/mcp/server.js` exposes the same tool registry over the [Model Context Protocol](https://modelcontextprotocol.io) (stdio), so Claude Desktop, Claude Code or any MCP client can ask the club's data the same questions the in-app assistant can, with the same role scoping.

- Runs **as one configured user** (`MCP_USER_EMAIL`) and exposes only that role's tools; refuses to start unscoped.
- Tools carry `readOnlyHint` annotations; a `sankalp://whoami` resource and a `prepare_for_next_session` prompt cover the three MCP primitives.
- stdout is the protocol channel; all logging is redirected to stderr before anything loads.

```bash
# Claude Code
claude mcp add sankalp -e MCP_USER_EMAIL=you@example.com -- node /absolute/path/to/server/mcp/server.js
```

```json
{
  "mcpServers": {
    "sankalp": {
      "command": "node",
      "args": ["/absolute/path/to/server/mcp/server.js"],
      "env": { "MCP_USER_EMAIL": "you@example.com" }
    }
  }
}
```

### Evals

`server/evals/` holds a 29-query golden set over the resource library (direct / paraphrase / exact-term / cross-grade / negative) and two harnesses that call `ai-service` for the real pipeline and save every run to `eval_runs`, diffed against the previous one:

```bash
cd server
npm run eval:retrieval      # precision@k, recall@k, MRR, hit@1, false-positive rate; vector vs hybrid side by side
npm run eval:generation     # real lesson plans graded by deterministic checks + an LLM judge (faithfulness, grade fit, low-resource, completeness)
```

Findings so far: the similarity threshold is a property of the embedding model (0.75 tuned for OpenAI gave 21 % recall on Gemini; 0.62 gives 100 % with zero false positives); hybrid search ties vector on this library, so vector stays the default; the judge caught a plan asking for "one printed copy of the story", which led to a prompt fix. Details and caveats in [`server/evals/README.md`](server/evals/README.md).

---

## Frontend structure

```mermaid
flowchart TD
    subgraph Providers
        AP["AuthProvider<br/>login · google · logout · /auth/me"]
        TP[ToastProvider]
        SP["SessionsProvider<br/>one 30 s poll of /attendance-sessions<br/>shared by shell and pages"]
    end
    AP --> TP --> SP --> RT["Routes + ProtectedRoute (adminOnly?)"]

    RT --> L["/login"]
    RT --> D["/dashboard — Today"]
    RT --> VS["/volunteer-sessions"]
    RT --> AT["/attendance/:sessionId"]
    RT --> MA["/my-attendance-new — My record"]
    RT --> ST["/students, /students/:id"]
    RT --> AN["/analytics — Insights"]
    RT --> LP["/ai-notes — Lesson planner"]
    RT --> ASK["/ask — Ask Sankalp, SSE"]
    RT --> PR["/prep/:sessionId — Session prep"]
    RT --> AS["/admin-sessions (admin)"]
    RT --> AR["/attendance-report (admin)"]
    RT --> VO["/volunteers (admin)"]
    RT --> AA["/ai-activity (admin)"]
```

- Login, Today, Sessions and Attendance are in the main bundle; every other page is `lazy()`-loaded so first paint does not carry Recharts or the admin screens.
- `utils/api.js` is the single axios instance (Bearer token from `localStorage`, cookie fallback, 401 → `/login`). `aiAPI.askStream` uses `fetch` to read the SSE body and parses `token` / `retract` / `tool_start` / `tool_end` / `done` / `error` events.
- With no `VITE_API_URL`, the app stays same-origin and the Vite dev proxy forwards `/api` to `:5000`, avoiding CORS preflights entirely.
- Components: `Layout`, `Sidebar`, `Spine`, `PageHeader`, `StatStrip`, `SessionRow`, `LiveCode`, `Table`, `Modal`, `Prose` (renders model output), `Chart`, `DotGrid` (login animation), `Badge`, `Button`, `Card`, `Input`, `EmptyState`, `LoadingState`.

---

## Getting started

### Prerequisites

- Node.js 18+ (uses global `fetch`)
- Python 3.11+
- PostgreSQL 15+ with the `pgvector` extension (local, or Neon / Supabase — both have it on free tiers)
- At least one LLM key for the AI features (Groq for chat + Gemini for embeddings is the free setup). The rest of the app runs without any.

### 1. Clone and configure

```bash
git clone <repository-url>
cd sankalps-village-project
```

`server/.env` (copy from `.env.example` at the repo root):

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/sankalp
DATABASE_SSL=false                      # leave unset for hosted Postgres
JWT_SECRET=change_me
CLIENT_URL=http://localhost:5173

# Google sign-in (optional; email/password works without it)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_EMAIL_DOMAIN=lnmiit.ac.in       # unset = any Google account may join

# AI features (optional)
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TOKEN=<openssl rand -hex 32>  # must match ai-service/.env exactly
GROQ_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=groq
EMBEDDING_PROVIDER=gemini

# Legacy — see "Migration notes". server.js still opens a Mongo connection at boot.
MONGO_URI=mongodb://localhost:27017/sankalp-village-project
```

`ai-service/.env` (copy from `ai-service/.env.example`) — same `DATABASE_URL`, `DATABASE_SSL`, `AI_SERVICE_TOKEN` and provider keys as the server.

`client/.env` (copy from `client/.env.example`) — `VITE_GOOGLE_CLIENT_ID` if using Google sign-in; leave `VITE_API_URL` unset in development.

### 2. Install

```bash
cd server && npm install
cd ../client && npm install
cd ../ai-service
python -m venv .venv
.venv/Scripts/activate            # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

### 3. Database

```bash
cd server
npm run db:migrate          # creates the pgvector extension, every table, index and check constraint
npm run seed-club-data      # a term of realistic data (see Demo accounts)
```

Then, with `ai-service` running (step 4) and an embedding key configured:

```bash
npm run seed-resources      # 8 teaching resources → chunked, embedded and stored via POST /rag/resources
```

### 4. Run (three processes)

```bash
# ai-service, venv active
uvicorn app.main:app --reload --port 8000

# server
npm run dev                 # nodemon, http://localhost:5000

# client
npm run dev                 # vite, http://localhost:5173
```

Health checks: `GET http://localhost:5000/health` (no DB touch) and `GET|HEAD http://localhost:8000/health` (reports Postgres reachability and whether pgvector is installed).

### Run with Docker

The backend half of the stack (PostgreSQL + pgvector, the API, the AI service) is containerised; the client stays on the host under Vite, which proxies `/api` to `:5000`.

```bash
docker compose up --build        # db → migrate (one-shot) → ai-service → server
cd client && npm run dev         # http://localhost:5173
```

- `server/Dockerfile` and `ai-service/Dockerfile` build small images (`node:22-alpine`, `python:3.12-slim`), run as non-root users and carry `HEALTHCHECK`s against the same `/health` endpoints the uptime monitor uses.
- The `migrate` service applies `server/db/migrations` and exits; `server` waits for it to succeed. Re-runs are no-ops.
- `ai-service` is not published on the host — only the API container can reach it, which is the intended production topology.
- Secrets and LLM keys are read from `server/.env` / `ai-service/.env` if present; every variable needed to boot has a dev default in `docker-compose.yml`. `MONGO_URI` is unset, so the legacy Mongo connection is skipped.
- `docker compose --profile monitoring up` adds a Prometheus container (http://localhost:9090) scraping the API every 15 s (`ops/prometheus.yml`).

### Demo accounts

`npm run seed-club-data` writes a term of sessions, registrations, teaching logs and quiz scores from August 2026 up to today, for:

- **25 volunteers** and **6 coordinators (admin)**, all `<roll>@lnmiit.ac.in` — for example `23ucc501@lnmiit.ac.in` (volunteer) and `22ucc430@lnmiit.ac.in` (admin)
- **10 students** across Classes 3–5
- Password for every seeded account: **`Sankalp@2026`**

**One-click demo.** Set `DEMO_VOLUNTEER_EMAIL` and `DEMO_COORDINATOR_EMAIL` in `server/.env` (e.g. the two accounts above) and the login page shows **Demo as volunteer** / **Demo as coordinator** buttons — no password needed. The server checks that each account already has the matching role (it never grants one, and never hands out a super admin), demo sessions expire after 4 hours, and a demo coordinator can view the Volunteers page but not add, edit or remove anyone.

Accounts that have signed in with Google, and any super admin, are never touched by the seed. To make someone a super admin (able to change roles in the UI):

```sql
UPDATE users SET is_super_admin = true WHERE email = 'you@example.com';
```

---

## Testing

```bash
cd server
npm test                 # jest — 36 tests, ~10 s, no database or network
npm run test:coverage    # + lcov report
```

The API is built by `server/app.js` (`createApp()`), which opens no connection and listens on no port; `server.js` is the thin production entry that connects and listens. Tests mount the app under [Supertest](https://github.com/ladjs/supertest) with `db/index.js` replaced by a queued mock (`tests/helpers/mockDb.js`) that stands in for Drizzle's query builder, so each test states exactly which rows each query returns.

| Suite | Covers |
|---|---|
| `tests/auth.test.js` | `protect` (Bearer and cookie transports, wrong secret, deleted user, non-uuid short-circuit, user cache) and `authorize` role gate |
| `tests/teachingLogs.test.js` | the attendance write path end to end: body validation, session window, registration, code match and expiry, missing location, geofence distance, per-session location override, single-statement insert with duplicate count |
| `tests/aiBudget.test.js` | sliding-window rate limit (per user, `Retry-After`), daily token budget from persisted spend (headers, 429, cache and invalidation, DB failure forwarded) |
| `tests/errorHandler.test.js` | PostgreSQL error-code → HTTP status mapping, wrapped Drizzle errors, stack only in development |
| `tests/health.test.js` | `/health`, `/metrics` output, `X-Request-Id` echo, 404 fall-through |

Retrieval and generation quality are covered separately by the [evals](#evals).

---

## Logging and metrics

**Logs** are structured JSON lines from [pino](https://getpino.io) (`server/utils/logger.js`), pretty-printed when `NODE_ENV=development`. `server/middleware/requestLogger.js` (pino-http) writes one line per request with method, path, status, duration and `userId`, and assigns every request an id: the caller's `X-Request-Id` if it sent one, otherwise a fresh uuid. The id is echoed on the response, attached to the error handler's log line, and forwarded to `ai-service`, which tags its own logs and response with it — one id follows a request browser → Node → Python. `/health` and `/metrics` are not logged. Secrets (`authorization`, `cookie`, `password`, `token`, `activeCode`) are redacted before the line is written. `LOG_LEVEL` (default `info`; `silent` in tests) and `LOG_FORMAT=json` control output; the MCP server forces the destination to stderr because stdout is its wire.

**Metrics** are exposed for Prometheus at `GET /metrics` (`server/middleware/metrics.js`, prom-client):

| Metric | Type | Labels |
|---|---|---|
| `http_request_duration_seconds` | histogram | `method`, `route` (the mounted pattern, e.g. `/api/students/:id`), `status_code` |
| `http_requests_total` | counter | same |
| `process_*`, `nodejs_*` | gauges/counters | prom-client defaults: CPU, memory, event-loop lag, handles |

Histogram buckets run 10 ms – 30 s so both the ordinary API (one database round trip) and the AI routes (seconds) land somewhere useful. Route labels use the Express pattern rather than the raw URL so cardinality stays one series per endpoint.

---

## Configuration reference

| Variable | Service | Purpose |
|---|---|---|
| `DATABASE_URL`, `DATABASE_SSL` | server, ai-service | PostgreSQL connection; `DATABASE_SSL=false` for local |
| `JWT_SECRET` | server | Signs 30-day tokens |
| `CLIENT_URL` | server | CORS origin (preflight cached 24 h) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAIN` | server | Google sign-in and optional domain restriction |
| `VITE_GOOGLE_CLIENT_ID`, `VITE_API_URL` | client | Same client id; API origin (unset = same-origin) |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | server ↔ ai-service | Node → Python hop; token must match on both sides |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | server, ai-service | Provider keys |
| `LLM_PROVIDER`, `EMBEDDING_PROVIDER`, `LLM_CHAT_MODEL`, `LLM_EMBEDDING_MODEL` | server, ai-service | Provider/model selection; changing the embedding model requires `npm run seed-resources` |
| `RETRIEVAL_MODE`, `RAG_SIMILARITY_THRESHOLD` | ai-service (mirrored in server for display) | `vector` \| `hybrid`; threshold override — re-run `eval:retrieval` before changing |
| `AI_RATE_LIMIT_REQUESTS`, `AI_RATE_LIMIT_WINDOW_MS`, `AI_DAILY_TOKEN_BUDGET_PER_USER` | server | Guardrails |
| `SCHOOL_LAT`, `SCHOOL_LNG`, `ATTENDANCE_RADIUS_M` | server | Default geofence when a session has no location (1000 m) |
| `USER_CACHE_TTL_MS` | server | `protect()` user cache (15 s) |
| `LOG_LEVEL`, `LOG_FORMAT`, `LOG_DESTINATION` | server | pino level (default `info`); `json` to disable pretty output in development; `stderr` (set by the MCP server) |
| `MCP_USER_EMAIL` | MCP server | Which Sankalp user the MCP server acts as |
| `MONGO_URI` | server | Legacy, optional — unset skips the connection; see Migration notes |

---

## API reference

All routes are under `/api` and require `Authorization: Bearer <jwt>` (or the `token` cookie) unless marked public. **Admin** = `authorize('admin')`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | public — `{ email, password }` |
| POST | `/auth/google` | public — `{ credential }` (Google ID token) |
| POST | `/auth/logout` | clears the cookie |
| GET | `/auth/me` | current user |

### Attendance
| Method | Path | Notes |
|---|---|---|
| GET | `/attendance-sessions` | all sessions; rotates stale codes; code visible to admins only |
| POST | `/attendance-sessions` | admin — `{ title, startTime, endTime, location? }` |
| GET / DELETE | `/attendance-sessions/:id` | delete is admin |
| POST | `/attendance-sessions/:id/generate-code` | admin — force a new code |
| POST | `/registrations/register` | `{ sessionId }` |
| GET | `/registrations/my-registrations` | |
| GET | `/registrations/session/:sessionId` | admin |
| DELETE | `/registrations/:id` | |
| POST | `/teaching-logs/submit` | `{ session_id, code, lat, lng, entries: [{ student_id, subject, topic }] }` |
| GET | `/teaching-logs/my-logs` | |
| GET | `/teaching-logs/session/:sessionId` | admin |
| GET | `/teaching-logs` | admin — everything |
| GET | `/volunteer-attendance/my-attendance` | |
| GET | `/volunteer-attendance`, `/volunteer-attendance/:volunteerId` | admin |

### Students, users, analytics
| Method | Path | Notes |
|---|---|---|
| GET / POST | `/students` | |
| GET / PUT / DELETE | `/students/:id` | delete is admin |
| GET | `/students/:id/progress` | |
| POST | `/students/:id/quiz-score` | |
| GET / POST | `/users` | admin; creating an admin needs super admin |
| GET / PUT / DELETE | `/users/:id` | admin; changing `role` needs super admin |
| GET | `/analytics/overview` | totals + last-30-day series, computed in SQL |

### AI
| Method | Path | Notes |
|---|---|---|
| POST | `/ai/generate-notes` | guarded — `{ topic, subject, grade, extraInstructions? }` |
| POST | `/ai/ask` | guarded — `{ conversationId?, question }` |
| POST | `/ai/ask/stream` | guarded — same body, Server-Sent Events |
| GET | `/ai/conversations` | my conversations |
| GET / DELETE | `/ai/conversations/:id` | owner only |
| GET / POST | `/ai/resources` | list (any) / create (admin — chunk + embed via ai-service) |
| GET | `/ai/admin/activity` | admin — observability aggregate |
| GET | `/ai/admin/runs/:id` | admin — one run with its steps |
| POST | `/prep/sessions/:sessionId` | guarded — draft (or return) my plan; `{ force? }` |
| GET | `/prep/sessions/:sessionId` | my plan for the session |
| GET | `/prep/mine` | my plans |
| PATCH | `/prep/:id` | edit focus groups (owner, draft only) |
| POST | `/prep/:id/approve`, `/prep/:id/reject` | owner; reject needs `{ reason }` |
| GET / POST | `/prep/sessions/:sessionId/all` | admin — list / draft for all registered volunteers |

"Guarded" = behind `aiRateLimit` and `aiDailyBudget`.

### ai-service (internal — only Node calls it)
| Method | Path | Notes |
|---|---|---|
| GET/HEAD | `/health` | public probe |
| GET | `/internal/whoami` | echoes the trusted user context |
| POST | `/rag/embed`, `/rag/retrieve`, `/rag/lesson-plan`, `/rag/resources` | resources is admin-only (defence in depth) |
| POST | `/agent/ask`, `/agent/ask/stream` | |

Every internal call carries `Authorization: Bearer <AI_SERVICE_TOKEN>`, `X-Sankalp-User-Id`, `X-Sankalp-User-Role`, `X-Sankalp-User-Name` and `X-Request-Id`.

---

## Scripts

Run from `server/`:

| Command | What it does |
|---|---|
| `npm run dev` / `npm start` | API with nodemon / plain node |
| `npm test` / `npm run test:coverage` | Jest + Supertest suite (see [Testing](#testing)) |
| `npm run db:generate` | `drizzle-kit generate` — new migration from `db/schema.js` |
| `npm run db:migrate` | apply `db/migrations/*.sql` (tracked in `drizzle.__drizzle_migrations`) |
| `npm run seed-club-data` | rebuild a term of realistic data (keeps Google-linked and super-admin accounts) |
| `npm run seed-resources` | ingest the 8 sample teaching resources through `ai-service` |
| `npm run prep-next-session` | draft session-prep plans for every registered volunteer of the next session |
| `npm run eval:retrieval` / `npm run eval:generation` | eval harnesses (see [Evals](#evals)) |
| `npm run mcp` | start the MCP server (needs `MCP_USER_EMAIL`) |
| `npm run list-users`, `npm run change-role <email> <role>`, `npm run manage-roles` | user administration against PostgreSQL |
| `npm run clear-data` | wipe the database |
| `npm run migrate-to-pg` | one-off Mongo → PostgreSQL data copy (legacy) |
| `npm run create-test-data` | **legacy — writes to MongoDB via Mongoose, not PostgreSQL.** Use `seed-club-data` instead |

---

## Deployment

```mermaid
flowchart LR
    U[Users] --> V["Vercel<br/>client/ (static, SPA rewrite)"]
    V -- "VITE_API_URL" --> R["Render<br/>server/ (Node)<br/>/health pinged by uptime monitor"]
    R -- "AI_SERVICE_URL (private)" --> P["Render / any host<br/>ai-service/ (uvicorn)<br/>/health GET+HEAD"]
    R --> N[("Neon<br/>PostgreSQL + pgvector")]
    P --> N
    R --> G[Groq / Gemini / OpenAI]
    P --> G
```

- `client/vercel.json` rewrites every path to `index.html`. Set `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` in the Vercel project.
- The API sets `secure` / `sameSite: 'none'` cookies in production; `CLIENT_URL` must be the exact Vercel origin.
- `ai-service` should not be reachable from the public internet — nothing but Node needs it, and its auth is a shared secret.
- Free-tier hosts sleep after idle; both `/health` endpoints exist so an uptime monitor can keep them warm.
- Any container host works too: both services ship a `Dockerfile` (see [Run with Docker](#run-with-docker)). Point a Prometheus scraper at the API's `/metrics` and ship its stdout JSON lines to your log store.
- The API handles `SIGTERM` by closing the listener and letting in-flight requests finish, so rolling deploys do not drop connections.
- Changing the embedding provider/model in production requires re-running `npm run seed-resources` (or re-ingesting your own resources), otherwise retrieval finds no chunks stamped with the new model.

---

## Project structure

```
sankalps-village-project/
├── client/                         # React 18 + Vite SPA
│   ├── src/
│   │   ├── components/             # Layout, Sidebar, Spine, PageHeader, StatStrip, SessionRow,
│   │   │                           # LiveCode, Table, Modal, Prose, Chart, DotGrid, …
│   │   ├── context/                # AuthContext, ToastContext, SessionsContext
│   │   ├── pages/                  # Login, Dashboard, VolunteerSessions, AttendancePage, MyAttendanceNew,
│   │   │                           # Students, StudentProgress, Analytics, AITeachingNotes, AskSankalp,
│   │   │                           # SessionPrep, AdminSessions, AttendanceReport, Volunteers, AIActivity
│   │   └── utils/                  # api.js (axios + SSE), session.js (state + formatting)
│   ├── vercel.json
│   └── vite.config.js              # /api → localhost:5000 dev proxy
│
├── server/                         # Express API (CommonJS)
│   ├── server.js                   # entry — connects PG, listens, SIGTERM shutdown
│   ├── app.js                      # createApp(): middleware, routers, /health, /metrics (no I/O)
│   ├── Dockerfile                  # node:22-alpine, non-root, HEALTHCHECK
│   ├── tests/                      # jest + supertest (auth, attendance write path, AI budget, errors, ops)
│   ├── db/
│   │   ├── schema.js               # Drizzle schema (every table, index, check)
│   │   ├── migrations/             # generated SQL + snapshots
│   │   ├── pool.js · index.js      # pg pool, drizzle() instance
│   │   └── serialize.js            # rows → { _id, id, … } the client expects
│   ├── routes/                     # auth, users, students, analytics, ai, prep,
│   │                               # attendanceSessions, registrations, teachingLogs, volunteerAttendance
│   ├── controllers/                # one per router (+ aiAdminController)
│   ├── middleware/                 # auth.js (protect/authorize + user cache), aiBudget.js, errorHandler.js,
│   │                               # requestLogger.js (pino-http + X-Request-Id), metrics.js (prom-client)
│   ├── utils/logger.js             # pino root logger (JSON in prod, pretty in dev, redaction)
│   ├── services/
│   │   ├── aiServiceClient.js      # Node → Python: headers, timeouts, error translation, SSE pass-through
│   │   ├── ragService.js           # thin proxy to /rag/*
│   │   ├── llmClient.js            # provider table + chatWithRetry (used by session prep)
│   │   ├── agentTools.js           # Node copy of the 7 tools (session prep + MCP)
│   │   └── sessionPrepService.js   # gather → plan → retrieve → write → draft
│   ├── mcp/server.js               # Model Context Protocol server (stdio)
│   ├── evals/                      # golden set, retrieval + generation harnesses, metrics
│   ├── scripts/                    # seeds, migrations, role management, prep batch job
│   ├── models/                     # legacy Mongoose models (used only by migrateToPg + old test scripts)
│   └── drizzle.config.js
│
├── ai-service/                     # FastAPI (async)
│   ├── app/
│   │   ├── main.py                 # app, lifespan pool, X-Request-Id middleware, /health, /internal/whoami
│   │   ├── config.py               # pydantic-settings (same env names as Node)
│   │   ├── internal_auth.py        # shared-token + X-Sankalp-User-* → InternalUser
│   │   ├── llm.py                  # provider table (mirrors llmClient.js)
│   │   ├── errors.py               # ProviderError envelope
│   │   ├── db.py                   # asyncpg pool, pgvector codec, health
│   │   ├── routes/                 # rag.py, agent.py
│   │   ├── rag/                    # chunking, embeddings, retriever (pgvector + hybrid), lexical (BM25/RRF),
│   │   │                           # generation, ingest, chat (ChatOpenAI + retry)
│   │   ├── tools/                  # the 7 LangChain tools + role metadata
│   │   └── agent/                  # graph.py (LangGraph), runner.py, history.py, persistence.py, prompt.py
│   ├── Dockerfile                  # python:3.12-slim, non-root, HEALTHCHECK
│   └── requirements.txt
│
├── docker-compose.yml              # db (pgvector) → migrate → ai-service → server [+ prometheus profile]
├── ops/prometheus.yml              # scrape config for the monitoring profile
├── .env.example                    # server env template
├── AI_AGENTS_GUIDE.md              # beginner-friendly deep dive into the agent, tools, RAG and workflow
├── CLAUDE.md                       # guidance for AI coding assistants working in this repo
├── RAG_NOTES.md                    # RAG implementation notes
└── README.md
```

---

## Migration notes

The project moved from MongoDB/Mongoose to PostgreSQL/Drizzle, and the RAG + agent code moved from Node into a Python service. Everything the app does at runtime now goes through PostgreSQL and `ai-service`. A few leftovers are intentional and worth knowing:

- `server/server.js` still calls `connectDB()` (Mongoose) at boot and exits if the connection fails, so `MONGO_URI` must point at a reachable MongoDB until that call is removed. No route queries Mongo.
- `server/models/` (Mongoose) and `npm run migrate-to-pg` exist only for the one-off data copy. `create-test-volunteers` / `create-test-students` are older Mongo scripts; `seed-club-data` is the PostgreSQL seed.
- `mongoose` remains in `server/package.json` for the reasons above.

Removing `connectDB()`, `config/db.js`, `models/`, the two legacy scripts and the `mongoose` dependency is the last step of the migration.

---

## License

**Proprietary and Confidential** — All rights reserved.

This software is proprietary to Sankalp. No permission is granted to use, copy, modify, or distribute without prior written authorization. See [LICENSE](LICENSE) for full terms.
