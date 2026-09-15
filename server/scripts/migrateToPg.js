// One-off data migration: copies everything in MongoDB into PostgreSQL.
//
//   npm run migrate-to-pg              # refuses if the PG tables are non-empty
//   npm run migrate-to-pg -- --force   # wipes the PG tables first, then copies
//
// Mongo ObjectIds are never reused as PostgreSQL primary keys (they are not
// valid uuids); every row gets a fresh `gen_random_uuid()` (via each table's
// column default) and every reference to another collection is rewritten
// through an in-memory legacy-id map built as each table is copied — the
// tables are copied in FK order (users -> students -> sessions ->
// registrations/teaching-logs -> resources/chunks -> agent runs/steps ->
// lesson plan drafts -> eval runs) specifically so that every map a later
// table needs already exists by the time it runs.
require('dotenv').config();

const mongoose = require('mongoose');
const crypto = require('crypto');
const { sql } = require('drizzle-orm');
const connectDB = require('../config/db');
const { getDb } = require('../db');
const schema = require('../db/schema');
const { parseGradeNumber } = require('../utils/grade');

const User = require('../models/User');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');
const TeachingLog = require('../models/TeachingLog');
const Resource = require('../models/Resource');
const AgentRun = require('../models/AgentRun');
const LessonPlanDraft = require('../models/LessonPlanDraft');
const EvalRun = require('../models/EvalRun');

const FORCE = process.argv.includes('--force');

// Mongo _id (24-hex string) -> new PostgreSQL uuid, one map per collection.
const idMap = {
  users: new Map(),
  students: new Map(),
  sessions: new Map(),
  resources: new Map(),
  conversations: new Map() // AgentRun.conversationId was a bare ObjectId, not a ref — remapped the same way
};

const mapId = (map, mongoId) => (mongoId ? map.get(String(mongoId)) || null : null);

async function assertTargetsEmpty(db) {
  if (FORCE) return;
  const [{ count }] = await db.select({ count: sql`count(*)::int` }).from(schema.users);
  if (count > 0) {
    throw new Error('PostgreSQL already has data (users is non-empty). Re-run with --force to wipe every migrated table and copy again.');
  }
}

async function wipeTargets(db) {
  // Children first, in FK order, then parents.
  await db.delete(schema.evalRuns);
  await db.delete(schema.agentRunSteps);
  await db.delete(schema.agentRuns);
  await db.delete(schema.lessonPlanDrafts);
  await db.delete(schema.resourceChunks);
  await db.delete(schema.resources);
  await db.delete(schema.teachingLogs);
  await db.delete(schema.registrations);
  await db.delete(schema.attendanceSessions);
  await db.delete(schema.quizScores);
  await db.delete(schema.students);
  await db.delete(schema.users);
}

async function migrateUsers(db) {
  // `password` is `select: false` on the Mongoose schema — every query
  // (`.lean()` included) omits it unless explicitly asked for. Missing this
  // would silently migrate every account with no password at all.
  const docs = await User.find().select('+password').lean();
  if (docs.length === 0) return 0;
  const rows = docs.map((d) => ({
    name: d.name,
    email: d.email,
    passwordHash: d.password || null,
    googleId: d.googleId || null,
    role: d.role,
    phone: d.phone || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }));
  const inserted = await db.insert(schema.users).values(rows).returning({ id: schema.users.id });
  docs.forEach((d, i) => idMap.users.set(String(d._id), inserted[i].id));
  return docs.length;
}

async function migrateStudents(db) {
  const docs = await Student.find().lean();
  if (docs.length === 0) return { students: 0, quizScores: 0 };
  const rows = docs.map((d) => ({
    name: d.name,
    grade: d.grade,
    gradeNumber: parseGradeNumber(d.grade),
    enrollmentDate: d.enrollmentDate,
    parentPhone: d.parentPhone || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }));
  const inserted = await db.insert(schema.students).values(rows).returning({ id: schema.students.id });
  docs.forEach((d, i) => idMap.students.set(String(d._id), inserted[i].id));

  const quizRows = [];
  docs.forEach((d) => {
    const studentId = idMap.students.get(String(d._id));
    for (const q of d.quizScores || []) {
      quizRows.push({
        studentId,
        subject: q.subject,
        topic: q.topic,
        score: String(q.score),
        maxScore: String(q.maxScore),
        takenAt: q.date || new Date()
      });
    }
  });
  if (quizRows.length > 0) await db.insert(schema.quizScores).values(quizRows);

  return { students: docs.length, quizScores: quizRows.length };
}

async function migrateSessions(db) {
  const docs = await AttendanceSession.find().lean();
  if (docs.length === 0) return 0;
  const rows = docs.map((d) => ({
    title: d.title,
    startTime: d.startTime,
    endTime: d.endTime,
    activeCode: d.activeCode || null,
    codeExpiry: d.codeExpiry || null,
    lat: d.location?.lat ?? null,
    lng: d.location?.lng ?? null,
    createdBy: mapId(idMap.users, d.createdBy),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }));
  const inserted = await db.insert(schema.attendanceSessions).values(rows).returning({ id: schema.attendanceSessions.id });
  docs.forEach((d, i) => idMap.sessions.set(String(d._id), inserted[i].id));
  return docs.length;
}

async function migrateRegistrations(db) {
  const docs = await Registration.find().lean();
  if (docs.length === 0) return 0;
  const rows = docs
    .map((d) => ({
      userId: mapId(idMap.users, d.userId),
      sessionId: mapId(idMap.sessions, d.sessionId),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
    .filter((r) => r.userId && r.sessionId); // drop rows whose parent was itself missing/dangling in Mongo
  if (rows.length > 0) await db.insert(schema.registrations).values(rows);
  return rows.length;
}

async function migrateTeachingLogs(db) {
  const docs = await TeachingLog.find().lean();
  if (docs.length === 0) return 0;
  const rows = docs
    .map((d) => ({
      volunteerId: mapId(idMap.users, d.volunteerId),
      sessionId: mapId(idMap.sessions, d.sessionId),
      studentId: mapId(idMap.students, d.studentId),
      subject: d.subject,
      topic: d.topic,
      loggedAt: d.timestamp,
      codeUsed: d.codeUsed,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
    // A dangling reference (e.g. a deleted student the old Mongo schema never
    // enforced) cannot satisfy the new foreign keys — skip it rather than fail
    // the whole migration, and report the count.
    .filter((r) => r.volunteerId && r.sessionId && r.studentId);
  const dropped = docs.length - rows.length;
  if (rows.length > 0) await db.insert(schema.teachingLogs).values(rows);
  return { migrated: rows.length, dropped };
}

async function migrateResources(db) {
  const docs = await Resource.find().lean();
  if (docs.length === 0) return { resources: 0, chunks: 0 };
  const rows = docs.map((d) => ({
    title: d.title,
    subject: d.subject,
    grade: d.grade,
    gradeNumber: parseGradeNumber(d.grade),
    content: d.content,
    embeddingModel: d.embeddingModel || null,
    createdBy: mapId(idMap.users, d.createdBy),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  }));
  const inserted = await db.insert(schema.resources).values(rows).returning({ id: schema.resources.id });
  docs.forEach((d, i) => idMap.resources.set(String(d._id), inserted[i].id));

  const chunkRows = [];
  docs.forEach((d) => {
    const resourceId = idMap.resources.get(String(d._id));
    (d.chunks || []).forEach((c, index) => {
      chunkRows.push({
        resourceId,
        chunkIndex: index,
        text: c.text,
        embedding: c.embedding,
        embeddingModel: d.embeddingModel || 'text-embedding-3-small'
      });
    });
  });
  if (chunkRows.length > 0) await db.insert(schema.resourceChunks).values(chunkRows);

  return { resources: docs.length, chunks: chunkRows.length };
}

async function migrateAgentRuns(db) {
  const docs = await AgentRun.find().lean();
  if (docs.length === 0) return { runs: 0, steps: 0 };

  const rows = docs.map((d) => {
    const mongoConvId = String(d.conversationId);
    if (!idMap.conversations.has(mongoConvId)) idMap.conversations.set(mongoConvId, crypto.randomUUID());
    return {
      userId: mapId(idMap.users, d.userId),
      conversationId: idMap.conversations.get(mongoConvId),
      role: d.role,
      question: d.question,
      answer: d.answer || '',
      status: d.status,
      model: d.model,
      iterations: d.iterations || 0,
      durationMs: d.durationMs || 0,
      llmMs: d.llmMs || 0,
      promptTokens: d.usage?.promptTokens || 0,
      completionTokens: d.usage?.completionTokens || 0,
      error: d.error || '',
      createdAt: d.createdAt
    };
  });
  const validRows = [];
  const validDocs = [];
  rows.forEach((r, i) => {
    if (r.userId) { validRows.push(r); validDocs.push(docs[i]); }
  });

  const inserted = await db.insert(schema.agentRuns).values(validRows).returning({ id: schema.agentRuns.id });

  const stepRows = [];
  validDocs.forEach((d, i) => {
    const runId = inserted[i].id;
    for (const s of d.steps || []) {
      stepRows.push({
        runId,
        iteration: s.iteration ?? null,
        tool: s.tool ?? null,
        args: s.args ?? null,
        ok: s.ok ?? null,
        durationMs: s.durationMs ?? null,
        resultPreview: s.resultPreview ?? null,
        error: s.error ?? null
      });
    }
  });
  if (stepRows.length > 0) await db.insert(schema.agentRunSteps).values(stepRows);

  return { runs: validRows.length, steps: stepRows.length };
}

async function migrateLessonPlanDrafts(db) {
  const docs = await LessonPlanDraft.find().lean();
  if (docs.length === 0) return 0;

  const remapFocusGroups = (groups) =>
    (groups || []).map((g) => ({
      ...g,
      students: (g.students || []).map((s) => ({
        name: s.name,
        studentId: mapId(idMap.students, s.studentId)
      }))
    }));

  const rows = docs
    .map((d) => ({
      sessionId: mapId(idMap.sessions, d.sessionId),
      volunteerId: mapId(idMap.users, d.volunteerId),
      status: d.status,
      focusGroups: remapFocusGroups(d.focusGroups),
      reviewNote: d.reviewNote || '',
      reviewedAt: d.reviewedAt || null,
      editedByVolunteer: Boolean(d.editedByVolunteer),
      contextSummary: d.contextSummary || {},
      trace: d.trace || [],
      promptTokens: d.usage?.promptTokens || 0,
      completionTokens: d.usage?.completionTokens || 0,
      provider: d.generatedBy?.provider || null,
      model: d.generatedBy?.model || null,
      durationMs: d.durationMs || 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
    .filter((r) => r.sessionId && r.volunteerId);

  if (rows.length > 0) await db.insert(schema.lessonPlanDrafts).values(rows);
  return rows.length;
}

async function migrateEvalRuns(db) {
  const docs = await EvalRun.find().lean();
  if (docs.length === 0) return 0;
  const rows = docs.map((d) => ({
    kind: d.kind,
    config: d.config || {},
    metrics: d.metrics || {},
    perQuery: d.perQuery || [],
    durationMs: d.durationMs || 0,
    note: d.note || '',
    createdAt: d.createdAt
  }));
  await db.insert(schema.evalRuns).values(rows);
  return rows.length;
}

async function main() {
  await connectDB(); // Mongo (source)
  const db = getDb(); // PostgreSQL (destination) — also requires DATABASE_URL

  console.log('Checking destination tables...');
  await assertTargetsEmpty(db);
  if (FORCE) {
    console.log('--force: wiping migrated PostgreSQL tables first.');
    await wipeTargets(db);
  }

  console.log('\nMigrating users...');
  console.log(`  ${await migrateUsers(db)} users`);

  console.log('Migrating students + quiz scores...');
  const s = await migrateStudents(db);
  console.log(`  ${s.students} students, ${s.quizScores} quiz scores`);

  console.log('Migrating attendance sessions...');
  console.log(`  ${await migrateSessions(db)} sessions`);

  console.log('Migrating registrations...');
  console.log(`  ${await migrateRegistrations(db)} registrations`);

  console.log('Migrating teaching logs...');
  const t = await migrateTeachingLogs(db);
  console.log(`  ${t.migrated} teaching logs${t.dropped ? ` (${t.dropped} skipped — dangling reference in Mongo)` : ''}`);

  console.log('Migrating resources + chunks...');
  const r = await migrateResources(db);
  console.log(`  ${r.resources} resources, ${r.chunks} chunks`);

  console.log('Migrating agent runs + steps...');
  const a = await migrateAgentRuns(db);
  console.log(`  ${a.runs} agent runs, ${a.steps} steps`);

  console.log('Migrating lesson plan drafts...');
  console.log(`  ${await migrateLessonPlanDrafts(db)} drafts`);

  console.log('Migrating eval runs...');
  console.log(`  ${await migrateEvalRuns(db)} eval runs`);

  console.log('\nDone. PostgreSQL now holds a copy of the MongoDB data. MongoDB itself is untouched.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
