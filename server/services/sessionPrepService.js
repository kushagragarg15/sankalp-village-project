const { z } = require('zod');
const { eq, and, inArray } = require('drizzle-orm');
const { getDb } = require('../db');
const { lessonPlanDrafts, students } = require('../db/schema');
const { CHAT_MODEL, CHAT_PROVIDER, chatWithRetry } = require('./llmClient');
const { retrieveContext } = require('./ragService');
const { tools, normaliseSubject } = require('./agentTools');

/**
 * Session prep — a *workflow*, not an agent.
 *
 * "Ask Sankalp" lets the model decide which tools to call. Here the steps are
 * fixed and the model is only asked to do the two things that need judgment:
 * choose what to focus on, and write the teaching blocks. Everything else —
 * what data to gather, when to retrieve, what to save — is ordinary code.
 *
 *   gather  →  plan (LLM, JSON)  →  retrieve (RAG per group)  →  write (LLM, JSON)  →  save DRAFT
 *
 * The gather step reuses the agent's tools as plain functions. Same data
 * access, different orchestration.
 */

const MAX_GROUPS = 3;
const MAX_OUTPUT_TOKENS = 4000;

const toolByName = (name) => tools.find((t) => t.name === name);

// ---------------------------------------------------------------------------
// Schemas for what the model is allowed to hand back.
// ---------------------------------------------------------------------------

const PlanSchema = z.object({
  focusGroups: z
    .array(
      z.object({
        grade: z.string().min(1),
        subject: z.string().min(1),
        topic: z.string().min(1),
        rationale: z.string().min(1),
        studentNames: z.array(z.string().min(1)).min(1).max(8)
      })
    )
    .min(1)
    .max(MAX_GROUPS)
});

const BlocksSchema = z.object({
  blocks: z
    .array(
      z.object({
        index: z.number().int().min(0),
        objective: z.string().min(1),
        activity: z.string().min(1),
        checkQuestions: z.array(z.string().min(1)).min(2).max(4)
      })
    )
    .min(1)
});

// ---------------------------------------------------------------------------
// One JSON-mode model call, validated. Retries once with the validation error
// in the prompt, which fixes most malformed outputs.
// ---------------------------------------------------------------------------

async function askForJson({ system, user, schema, usage, label }) {
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await chatWithRetry({
      model: CHAT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' }
    });
    usage.promptTokens += completion.usage?.prompt_tokens || 0;
    usage.completionTokens += completion.usage?.completion_tokens || 0;

    const raw = completion.choices[0].message.content || '';
    let parsed;
    try {
      parsed = schema.parse(JSON.parse(raw));
      return parsed;
    } catch (err) {
      const problem = err.issues ? JSON.stringify(err.issues.slice(0, 3)) : err.message;
      if (attempt === 1) throw new Error(`${label}: model output failed validation: ${problem}`);
      messages.push({ role: 'assistant', content: raw });
      messages.push({
        role: 'user',
        content: `That was not valid. Problem: ${problem}. Reply again with only the corrected JSON.`
      });
    }
  }
  throw new Error(`${label}: unreachable`);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function gatherContext(volunteer) {
  const ctx = { user: volunteer };
  const [history, attention] = await Promise.all([
    toolByName('get_my_teaching_history').run({ limit: 20 }, ctx),
    toolByName('find_students_needing_attention').run({ notTaughtForDays: 14, lowScoreBelowPercent: 60 }, ctx)
  ]);

  const known = new Map();
  for (const s of history.myStudents) known.set(s.name, { name: s.name, grade: s.grade });
  for (const s of attention.students) if (!known.has(s.name)) known.set(s.name, { name: s.name, grade: s.grade });

  return {
    history,
    attention,
    known,
    summary: {
      studentsTaughtByVolunteer: history.myStudents.length,
      studentsFlagged: attention.flagged,
      lessonsByVolunteer: history.totals.lessons
    }
  };
}

const planSystem = `You plan the next weekend teaching session for one volunteer at a village school. You will be given the students they have taught (with topics, dates and quiz averages) and students the club has flagged as needing attention. Choose 1 to ${MAX_GROUPS} focus groups for a 2-3 hour session. Each group is a set of students who can be taught together: same class or adjacent classes, one subject, one specific topic. Prefer: revising topics where quiz averages are low or missing; children not seen recently; continuity with what the volunteer taught last time. Use ONLY student names exactly as given. Reply with JSON only, shaped: {"focusGroups":[{"grade":"Class 4","subject":"Maths","topic":"...","rationale":"one or two sentences","studentNames":["..."]}]}.`;

async function planFocus(context, session, usage) {
  const user = JSON.stringify(
    {
      session: { title: session.title, startTime: session.startTime },
      studentsIHaveTaught: context.history.myStudents.slice(0, 12),
      myRecentLessons: context.history.recentLessons.slice(0, 10),
      studentsNeedingAttention: context.attention.students.slice(0, 10)
    },
    null,
    0
  );

  const plan = await askForJson({ system: planSystem, user, schema: PlanSchema, usage, label: 'plan' });

  const groups = plan.focusGroups
    .map((g) => ({
      ...g,
      students: g.studentNames.filter((n) => context.known.has(n)).map((n) => ({ name: n }))
    }))
    .filter((g) => g.students.length > 0);

  if (groups.length === 0) {
    throw new Error('plan: every focus group named students that are not in your records');
  }
  return groups;
}

async function retrieveForGroups(groups) {
  return Promise.all(
    groups.map(async (g) => {
      const chunks = await retrieveContext({
        topic: g.topic, subject: normaliseSubject(g.subject), grade: g.grade, k: 3
      });
      return {
        ...g,
        passages: chunks.map((c) => ({ source: c.source.title, text: c.text.slice(0, 700) })),
        sources: chunks.map((c) => ({
          label: `${c.source.title} (${c.source.grade} ${c.source.subject})`,
          similarity: Number(c.similarity.toFixed(3))
        }))
      };
    })
  );
}

const writeSystem = `You write short teaching blocks for a volunteer in a one-room village classroom with almost no materials — chalk, a board, and everyday objects. For each focus group you are given, write: an objective (one sentence), a hands-on activity (4-6 short numbered steps, 15-20 minutes, no printed sheets), and 2-3 check questions with answers in brackets. Where teaching passages are provided, build on them and stay consistent with them. Plain text, no markdown headings. Reply with JSON only, shaped: {"blocks":[{"index":0,"objective":"...","activity":"...","checkQuestions":["... (answer)"]}]} with one block per group, index matching the group's index.`;

async function writeBlocks(groups, usage) {
  const user = JSON.stringify(
    {
      groups: groups.map((g, index) => ({
        index,
        grade: g.grade,
        subject: g.subject,
        topic: g.topic,
        students: g.students.map((s) => s.name),
        passages: g.passages
      }))
    },
    null,
    0
  );

  const { blocks } = await askForJson({ system: writeSystem, user, schema: BlocksSchema, usage, label: 'write' });
  const byIndex = new Map(blocks.map((b) => [b.index, b]));

  const unescape = (s) => (typeof s === 'string' ? s.replace(/\\n/g, '\n').trim() : s);

  return groups.map((g, index) => {
    const b = byIndex.get(index);
    return {
      grade: g.grade,
      subject: g.subject,
      topic: g.topic,
      rationale: g.rationale,
      students: g.students,
      objective: unescape(b?.objective) || '',
      activity: unescape(b?.activity) || '',
      checkQuestions: (b?.checkQuestions || []).map(unescape),
      sources: g.sources
    };
  });
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Draft (or return the existing) prep plan for one volunteer and one session.
 *
 * Idempotent by default: if a draft or approved plan already exists it is
 * returned untouched. `force` supersedes it and drafts afresh (the old one is
 * kept with status 'superseded', not deleted).
 */
async function prepareSession({ session, volunteer, force = false }) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(lessonPlanDrafts)
    .where(
      and(
        eq(lessonPlanDrafts.sessionId, session.id),
        eq(lessonPlanDrafts.volunteerId, volunteer.id),
        inArray(lessonPlanDrafts.status, ['draft', 'approved'])
      )
    )
    .limit(1);
  if (existing && !force) return { draft: existing, created: false };

  const started = Date.now();
  const usage = { promptTokens: 0, completionTokens: 0 };
  const trace = [];
  const timed = async (step, fn, detail) => {
    const t0 = Date.now();
    const out = await fn();
    trace.push({ step, durationMs: Date.now() - t0, detail: typeof detail === 'function' ? detail(out) : detail });
    return out;
  };

  const context = await timed('gather', () => gatherContext(volunteer), (c) =>
    `${c.summary.studentsTaughtByVolunteer} students taught, ${c.summary.studentsFlagged} flagged`
  );

  if (context.known.size === 0) {
    const err = new Error(
      'There is no teaching history or flagged students to plan from yet. Teach a session first, or ask the coordinator for a starting plan.'
    );
    err.status = 422;
    throw err;
  }

  const groups = await timed('plan', () => planFocus(context, session, usage), (g) =>
    g.map((x) => `${x.subject}: ${x.topic} (${x.students.length})`).join('; ')
  );
  const withPassages = await timed('retrieve', () => retrieveForGroups(groups), (g) =>
    `${g.reduce((n, x) => n + x.passages.length, 0)} passages`
  );
  const focusGroups = await timed('write', () => writeBlocks(withPassages, usage), 'blocks written');

  // Resolve names -> ids for the students we kept.
  const names = [...new Set(focusGroups.flatMap((g) => g.students.map((s) => s.name)))];
  const docs = names.length > 0 ? await db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.name, names)) : [];
  const idByName = new Map(docs.map((d) => [d.name, d.id]));
  for (const g of focusGroups) {
    g.students = g.students.map((s) => ({ name: s.name, studentId: idByName.get(s.name) || null }));
  }

  if (existing && force) {
    await db.update(lessonPlanDrafts).set({ status: 'superseded' }).where(eq(lessonPlanDrafts.id, existing.id));
  }

  const [draft] = await db
    .insert(lessonPlanDrafts)
    .values({
      sessionId: session.id,
      volunteerId: volunteer.id,
      status: 'draft',
      focusGroups,
      contextSummary: context.summary,
      trace,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      provider: CHAT_PROVIDER,
      model: CHAT_MODEL,
      durationMs: Date.now() - started
    })
    .returning();

  return { draft, created: true };
}

module.exports = { prepareSession };
