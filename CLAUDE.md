# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm packages, no workspace/monorepo tooling:

- `server/` — Express + Mongoose REST API (CommonJS, `require`). Entry: `server/server.js`.
- `client/` — React 18 + Vite SPA (ESM, `"type": "module"`). Entry: `client/src/main.jsx`.

There is **no build step, linter, or test suite** anywhere in this project. `npm test` is not defined; do not assume one exists. Verification is manual (run both servers, exercise the UI/API).

## Commands

Run from `server/`:

```bash
npm install
npm run dev                    # nodemon server.js  (http://localhost:5000)
npm start                      # node server.js (production)

# DB utility scripts (each connects using MONGO_URI, does its work, exits):
npm run seed-resources         # load teaching resources + embeddings for RAG (needs OPENAI_API_KEY)
npm run create-test-data       # create-test-volunteers + create-test-students
npm run create-test-volunteers
npm run create-test-students
npm run clear-data             # wipe collections
npm run list-users
npm run manage-roles           # interactive role editor
npm run change-role            # quick single-user role change
npm run update-user-role
npm run update-all-roles
```

Run from `client/`:

```bash
npm install
npm run dev                    # vite  (http://localhost:5173)
npm run build                  # vite build -> client/dist/
npm run preview
```

Note: README mentions `npm run seed` — that script does **not** exist. Use `create-test-data` + `seed-resources`.

The Vite dev server proxies `/api` -> `http://localhost:5000`, so the client works against a local backend with no `VITE_API_URL` set.

## Environment

`server/.env` (see `.env.example`; `server/.env` is gitignored):

- `MONGO_URI` (required) — a running MongoDB, local or Atlas.
- `JWT_SECRET` (required) — signs auth tokens.
- `CLIENT_URL` — CORS origin allowlist, default `http://localhost:5173`.
- `OPENAI_API_KEY` — required only for the RAG feature (`/api/ai/*` and `seed-resources`); the rest of the app runs without it.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required only for Google login.

`client/.env` (optional): `VITE_API_URL` (base host, `/api` is appended in `client/src/utils/api.js`), `VITE_GOOGLE_CLIENT_ID`.

## Architecture

### Auth — two token transports, both live at once

`authController` on login/OAuth **both** sets an httpOnly `token` cookie **and** returns the raw JWT in the JSON body. The client (`client/src/utils/api.js`) stores that JWT in `localStorage` and attaches it as `Authorization: Bearer <token>` via an Axios request interceptor; `withCredentials: true` also sends the cookie. `server/middleware/auth.js` `protect` checks the Bearer header first, then falls back to `req.cookies.token`. A 401 response makes the client clear localStorage and redirect to `/login`.

- `protect` — requires a valid token, loads `req.user`.
- `authorize(...roles)` — role gate, used as `protect, authorize('admin')`. Roles are `'admin'` and `'volunteer'` on the `User` model.

### Attendance system (the core domain) — `AttendanceSession` → `Registration` → `TeachingLog`

This is the current system. `Event` / `eventController` / `routes/events.js` and `volunteerAttendanceController` / `routes/volunteerAttendance.js` are **legacy** and still mounted in `server.js`; new work targets the attendance-session models. See `EVENTS_VS_ATTENDANCE_SESSIONS.md`.

1. Admin creates an `AttendanceSession` (title, `startTime`, `endTime`, `location {lat,lng}`).
2. `GET /api/attendance-sessions` lazily generates/rotates a 5-char `activeCode` (10-min `codeExpiry`) for sessions that are currently active — code generation is a side effect of the list controller, not a cron job. Client polls (~30s) to display it.
3. Volunteers `POST /api/registrations` for a session before they can log attendance.
4. `POST /api/teaching-logs/submit` is the critical write path. Body: `{ session_id, code, lat, lng, entries: [{ student_id, subject, topic }] }`. Server validates, in order: fields present → session exists and `now` within `[startTime, endTime]` → volunteer is registered → `code === activeCode` and not expired → device within 1km of session location (Haversine) → no duplicate. One `TeachingLog` row per entry; a **unique compound index `(sessionId, volunteerId, studentId)`** enforces no double-logging (expect Mongo error 11000 on retry).

`BACKEND_FLOW_DOCUMENTATION.md` has the detailed flow write-ups.

### RAG lesson planner — `server/services/`

`POST /api/ai/generate-notes` pipeline:

1. `ragService.retrieveContext()` — metadata pre-filter `Resource` docs by `subject`/`grade` (regex), then rank their pre-computed chunk embeddings against the query embedding by cosine similarity (plain JS, no vector DB), return top-k above `minSimilarity`.
2. Build a grounded prompt from the retrieved chunks and call the OpenAI chat API.
3. Response includes the generated plan **and** the source chunks with similarity scores (shown in the UI for transparency).

`embeddingService.js` wraps OpenAI `text-embedding-3-small` and does word-count chunking with overlap. Embeddings are computed and stored at seed time by `scripts/seedResources.js` — the `Resource` model persists `chunks: [{ text, embedding: [Number] }]`. `RAG_NOTES.md` has the design rationale.

### Backend request path

`routes/*.js` (thin, wires middleware) → `controllers/*.js` (all logic, `async` with `try/catch`, calls `next(err)`) → Mongoose models. `middleware/errorHandler.js` is the last-registered middleware and formats all errors as `{ success: false, message }`. Responses are consistently `{ success, data | message }`.

### Frontend

- `client/src/App.jsx` — all routes; a `PrivateRoute` wrapper guards authenticated pages, some pages branch on `user.role`.
- `client/src/context/AuthContext.jsx` — the only global state (user, `login`, `logout`, `loading`); calls `/api/auth/me` on load. Zustand is a dependency but state is Context-based.
- `client/src/utils/api.js` — every backend call goes through this one Axios instance and its named helper functions; add new endpoints here, not with ad-hoc `axios`/`fetch`.
- `client/src/components/` — presentational primitives (`Button`, `Card`, `Table`, `Modal`, `Input`, `Badge`, `EmptyState`, `Layout`, `Sidebar`). Styling is Tailwind utilities only. Pages hold their own data-fetching and loading/error state.

## Conventions & gotchas

- Model files are singular PascalCase; the RAG collection model is `Resource` (`server/models/Resource.js`), not `TeachingResource`.
- `client/src/pages/` contains near-duplicate WIP variants (`MyAttendance.jsx` vs `MyAttendanceNew.jsx`, `AttendancePage.jsx`, `VolunteerSessions.jsx`); check `App.jsx` to see which is actually routed before editing.
- Attendance submit payload uses snake_case keys (`session_id`, `student_id`) even though the rest of the codebase is camelCase.
- `BACKEND_FLOW_DOCUMENTATION.md`, `EVENTS_VS_ATTENDANCE_SESSIONS.md`, `PROJECT_PROPOSAL.md`, `INTERVIEW_PREP_GUIDE.md`, `PRESENTATION_IMAGES.md` and the `.tex` files are gitignored (kept local, not pushed) but are useful architecture references when present.
- `.env.example` lives at the repo root; the file the server actually reads is `server/.env`.
