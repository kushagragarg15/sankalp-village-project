const {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  doublePrecision,
  boolean,
  jsonb,
  vector,
  uniqueIndex,
  index,
  check
} = require('drizzle-orm/pg-core');
const { relations, sql } = require('drizzle-orm');

// The embedding model in use (server/services/llmClient.js: EMBEDDING_PROVIDER=gemini,
// model gemini-embedding-001) produces 3072-dimensional vectors. Verified against the
// actual stored data (all 19 chunks across the 8 seeded resources), not assumed.
// pgvector's HNSW/IVFFlat ANN indexes only support up to 2000 dims for the plain
// `vector` type, so this column is intentionally left without an ANN index — at
// today's corpus size (19 chunks) an exact sequential scan is fast and matches the
// current in-process cosine-similarity ranking exactly. Revisit (halfvec, or a
// smaller embedding dimension) if the resource library grows into the thousands.
const EMBEDDING_DIMENSIONS = 3072;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    // bcryptjs hash. Nullable because a Google-only account has none — mirrors
    // the Mongoose model's conditional `required: !googleId`, enforced in app code.
    passwordHash: text('password_hash'),
    googleId: text('google_id'),
    role: text('role').notNull().default('volunteer'),
    phone: text('phone').notNull().default(''),
    ...timestamps
  },
  (table) => [
    uniqueIndex('users_email_key').on(table.email),
    uniqueIndex('users_google_id_key').on(table.googleId),
    index('users_role_idx').on(table.role),
    check('users_role_check', sql`${table.role} IN ('admin', 'volunteer')`),
    check('users_password_or_google_check', sql`${table.passwordHash} IS NOT NULL OR ${table.googleId} IS NOT NULL`)
  ]
);

// ---------------------------------------------------------------------------
// Students + quiz scores
// ---------------------------------------------------------------------------
const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  grade: text('grade').notNull(),
  // Parsed once from `grade` (e.g. "Class 4" -> 4; "All"/non-numeric -> NULL).
  // Replaces the regex-based Class-n-plus-or-minus-1 filtering the Mongo
  // implementation did at query time.
  gradeNumber: integer('grade_number'),
  enrollmentDate: timestamp('enrollment_date', { withTimezone: true }).notNull().defaultNow(),
  parentPhone: text('parent_phone').notNull().default(''),
  ...timestamps
});

const quizScores = pgTable(
  'quiz_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    topic: text('topic').notNull(),
    score: numeric('score').notNull(),
    maxScore: numeric('max_score').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('quiz_scores_student_taken_idx').on(table.studentId, table.takenAt.desc()),
    check('quiz_scores_max_score_check', sql`${table.maxScore} > 0`),
    check('quiz_scores_score_check', sql`${table.score} >= 0 AND ${table.score} <= ${table.maxScore}`)
  ]
);

// ---------------------------------------------------------------------------
// Attendance: sessions, registrations, teaching logs
// ---------------------------------------------------------------------------
const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    activeCode: text('active_code'),
    codeExpiry: timestamp('code_expiry', { withTimezone: true }),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    ...timestamps
  },
  (table) => [
    index('attendance_sessions_window_idx').on(table.startTime, table.endTime),
    index('attendance_sessions_active_code_idx').on(table.activeCode),
    check('attendance_sessions_time_check', sql`${table.endTime} > ${table.startTime}`)
  ]
);

const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (table) => [uniqueIndex('registrations_user_session_key').on(table.userId, table.sessionId)]
);

const teachingLogs = pgTable(
  'teaching_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => users.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSessions.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    subject: text('subject').notNull(),
    topic: text('topic').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
    codeUsed: text('code_used').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('teaching_logs_session_volunteer_student_key').on(table.sessionId, table.volunteerId, table.studentId),
    index('teaching_logs_volunteer_logged_idx').on(table.volunteerId, table.loggedAt.desc()),
    index('teaching_logs_session_idx').on(table.sessionId),
    index('teaching_logs_student_idx').on(table.studentId)
  ]
);

// ---------------------------------------------------------------------------
// Resources + chunks (RAG library, pgvector)
// ---------------------------------------------------------------------------
const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    subject: text('subject').notNull(),
    grade: text('grade').notNull(),
    gradeNumber: integer('grade_number'),
    content: text('content').notNull(),
    embeddingModel: text('embedding_model'),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps
  },
  (table) => [index('resources_embedding_subject_grade_idx').on(table.embeddingModel, table.subject, table.grade)]
);

const resourceChunks = pgTable(
  'resource_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    text: text('text').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text('embedding_model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('resource_chunks_resource_chunk_key').on(table.resourceId, table.chunkIndex),
    index('resource_chunks_embedding_model_idx').on(table.embeddingModel)
  ]
);

// ---------------------------------------------------------------------------
// AI: agent runs + steps, lesson plan drafts, eval runs
// ---------------------------------------------------------------------------
const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // One id per chat; minted by the app on the first question in a conversation.
    conversationId: uuid('conversation_id').notNull(),
    role: text('role').notNull(),
    question: text('question').notNull(),
    answer: text('answer').notNull().default(''),
    status: text('status').notNull(),
    model: text('model').notNull(),
    iterations: integer('iterations').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    llmMs: integer('llm_ms').notNull().default(0),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    error: text('error').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('agent_runs_user_created_idx').on(table.userId, table.createdAt.desc()),
    index('agent_runs_user_conversation_created_idx').on(table.userId, table.conversationId, table.createdAt),
    check('agent_runs_role_check', sql`${table.role} IN ('admin', 'volunteer')`),
    check('agent_runs_status_check', sql`${table.status} IN ('completed', 'max_iterations', 'error')`)
  ]
);

const agentRunSteps = pgTable(
  'agent_run_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    iteration: integer('iteration'),
    tool: text('tool'),
    args: jsonb('args'),
    ok: boolean('ok'),
    durationMs: integer('duration_ms'),
    resultPreview: text('result_preview'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('agent_run_steps_run_idx').on(table.runId)]
);

const lessonPlanDrafts = pgTable(
  'lesson_plan_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSessions.id),
    volunteerId: uuid('volunteer_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('draft'),
    // Opaque, edited-as-a-whole structure (grade/subject/topic/rationale/students/
    // objective/activity/checkQuestions/sources per focus group) — not queried or
    // aggregated across rows, so JSONB rather than a child table.
    focusGroups: jsonb('focus_groups').notNull().default([]),
    reviewNote: text('review_note').notNull().default(''),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    editedByVolunteer: boolean('edited_by_volunteer').notNull().default(false),
    contextSummary: jsonb('context_summary').notNull().default({}),
    trace: jsonb('trace').notNull().default([]),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    provider: text('provider'),
    model: text('model'),
    durationMs: integer('duration_ms').notNull().default(0),
    ...timestamps
  },
  (table) => [
    index('lesson_plan_drafts_session_volunteer_status_idx').on(table.sessionId, table.volunteerId, table.status),
    index('lesson_plan_drafts_volunteer_created_idx').on(table.volunteerId, table.createdAt.desc()),
    check('lesson_plan_drafts_status_check', sql`${table.status} IN ('draft', 'approved', 'rejected', 'superseded')`)
  ]
);

const evalRuns = pgTable(
  'eval_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    config: jsonb('config').notNull().default({}),
    metrics: jsonb('metrics').notNull().default({}),
    perQuery: jsonb('per_query').notNull().default([]),
    durationMs: integer('duration_ms').notNull().default(0),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('eval_runs_kind_created_idx').on(table.kind, table.createdAt.desc()),
    check('eval_runs_kind_check', sql`${table.kind} IN ('retrieval', 'generation')`)
  ]
);

// ---------------------------------------------------------------------------
// Relations (used by Drizzle's relational query API, `db.query.*`)
// ---------------------------------------------------------------------------
const usersRelations = relations(users, ({ many }) => ({
  registrations: many(registrations),
  teachingLogs: many(teachingLogs),
  agentRuns: many(agentRuns)
}));

const studentsRelations = relations(students, ({ many }) => ({
  quizScores: many(quizScores),
  teachingLogs: many(teachingLogs)
}));

const quizScoresRelations = relations(quizScores, ({ one }) => ({
  student: one(students, { fields: [quizScores.studentId], references: [students.id] })
}));

const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  createdByUser: one(users, { fields: [attendanceSessions.createdBy], references: [users.id] }),
  registrations: many(registrations),
  teachingLogs: many(teachingLogs)
}));

const registrationsRelations = relations(registrations, ({ one }) => ({
  user: one(users, { fields: [registrations.userId], references: [users.id] }),
  session: one(attendanceSessions, { fields: [registrations.sessionId], references: [attendanceSessions.id] })
}));

const teachingLogsRelations = relations(teachingLogs, ({ one }) => ({
  volunteer: one(users, { fields: [teachingLogs.volunteerId], references: [users.id] }),
  session: one(attendanceSessions, { fields: [teachingLogs.sessionId], references: [attendanceSessions.id] }),
  student: one(students, { fields: [teachingLogs.studentId], references: [students.id] })
}));

const resourcesRelations = relations(resources, ({ many }) => ({
  chunks: many(resourceChunks)
}));

const resourceChunksRelations = relations(resourceChunks, ({ one }) => ({
  resource: one(resources, { fields: [resourceChunks.resourceId], references: [resources.id] })
}));

const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  user: one(users, { fields: [agentRuns.userId], references: [users.id] }),
  steps: many(agentRunSteps)
}));

const agentRunStepsRelations = relations(agentRunSteps, ({ one }) => ({
  run: one(agentRuns, { fields: [agentRunSteps.runId], references: [agentRuns.id] })
}));

const lessonPlanDraftsRelations = relations(lessonPlanDrafts, ({ one }) => ({
  session: one(attendanceSessions, { fields: [lessonPlanDrafts.sessionId], references: [attendanceSessions.id] }),
  volunteer: one(users, { fields: [lessonPlanDrafts.volunteerId], references: [users.id] })
}));

module.exports = {
  EMBEDDING_DIMENSIONS,
  users,
  students,
  quizScores,
  attendanceSessions,
  registrations,
  teachingLogs,
  resources,
  resourceChunks,
  agentRuns,
  agentRunSteps,
  lessonPlanDrafts,
  evalRuns,
  usersRelations,
  studentsRelations,
  quizScoresRelations,
  attendanceSessionsRelations,
  registrationsRelations,
  teachingLogsRelations,
  resourcesRelations,
  resourceChunksRelations,
  agentRunsRelations,
  agentRunStepsRelations,
  lessonPlanDraftsRelations
};
