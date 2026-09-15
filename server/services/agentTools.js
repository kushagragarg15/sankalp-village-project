const { sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { retrieveContext, generateLessonPlan } = require('./ragService');

/**
 * Tool registry for the "Ask Sankalp" agent.
 *
 * Each tool is a plain object:
 *   name        - what the model calls it by
 *   description - what the model reads to decide *when* to call it
 *   parameters  - JSON Schema for the arguments (OpenAI function-calling format)
 *   roles       - which user roles may see and call it
 *   run(args, ctx) -> JSON-serialisable result. `ctx.user` is the signed-in user.
 *
 * Two rules keep this safe:
 *  1. Role scoping happens on the server, twice. `toolsForRole()` decides which
 *     tools the model is even told about, and the agent loop re-checks before
 *     executing a call. The model is never trusted to police itself.
 *  2. Tools return only what the model needs. `parentPhone` is never selected,
 *     so it can never leak into a prompt or a transcript.
 *
 * Everything returned here is *data* the model reads, not instructions — a
 * student named "ignore previous instructions" must stay a student name. The
 * in-app agent's system prompt (now ai-service/app/agent/prompt.py) says so
 * explicitly, and tool results are wrapped in a clearly labelled block
 * before they are handed back — same discipline the MCP server and
 * sessionPrepService.js expect from these tools.
 */

const ROLES = { ALL: ['admin', 'volunteer'], ADMIN: ['admin'] };

// Teaching logs say "Maths", the resource library says "Math"; the model may use either.
const normaliseSubject = (s) => String(s || '').trim().replace(/^maths$/i, 'Math');

const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

const quizAverage = (scores) => {
  const valid = (scores || []).filter((q) => Number(q.maxScore) > 0);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, q) => sum + Number(q.score) / Number(q.maxScore), 0) / valid.length) * 100);
};

const tools = [
  // ---------------------------------------------------------------------------
  // RAG as a tool. The lesson planner's retrieval step, exposed so the agent can
  // look up teaching material the same way a volunteer would.
  // ---------------------------------------------------------------------------
  {
    name: 'search_teaching_resources',
    description:
      "Search the club's curated library of teaching resources by topic, subject and class. " +
      'Returns the most relevant passages with similarity scores. Use this when asked how to ' +
      'teach something, for activity ideas, or for what material the club has on a topic.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What to look up, e.g. "fractions" or "photosynthesis"' },
        subject: { type: 'string', description: 'Math, Science, English, Hindi or Social Studies' },
        grade: { type: 'string', description: 'Class level, e.g. "Class 5"' }
      },
      required: ['topic', 'subject', 'grade']
    },
    roles: ROLES.ALL,
    async run({ topic, subject, grade }) {
      const chunks = await retrieveContext({ topic, subject: normaliseSubject(subject), grade, k: 4 });
      return {
        matches: chunks.length,
        passages: chunks.map((c) => ({
          source: c.source.title,
          similarity: Number(c.similarity.toFixed(3)),
          text: c.text.slice(0, 600)
        }))
      };
    }
  },

  {
    name: 'draft_lesson_plan',
    description:
      'Generate a full structured lesson plan (objective, key concepts, explanation, activity, ' +
      "quiz) grounded in the club's teaching resources. Slow and expensive — only call it when " +
      'the user explicitly asks for a plan, not for a quick question.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        subject: { type: 'string' },
        grade: { type: 'string', description: 'e.g. "Class 4"' },
        extraInstructions: {
          type: 'string',
          description: 'Optional constraints, e.g. "no printed sheets", "mixed ability group"'
        }
      },
      required: ['topic', 'subject', 'grade']
    },
    roles: ROLES.ALL,
    async run(args) {
      const { lessonPlan, sources } = await generateLessonPlan({
        ...args, subject: normaliseSubject(args.subject)
      });
      return { lessonPlan, sources: sources.map((s) => s.label) };
    }
  },

  // ---------------------------------------------------------------------------
  // Students
  // ---------------------------------------------------------------------------
  {
    name: 'get_student_progress',
    description:
      "Look up one student by name (partial names work). Returns their class, how many sessions " +
      'they attended, which subjects and topics they were taught (most recent first) and their ' +
      'quiz scores. This is THE tool for any question about a named child ("how is Aarti doing?"), ' +
      "whoever taught them. Only skip it if you already have that child's data from a tool result " +
      'earlier in this conversation.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Student name or part of it, e.g. "Aarti"' }
      },
      required: ['name']
    },
    roles: ROLES.ALL,
    async run({ name }) {
      const db = getDb();
      const candidates = (
        await db.execute(sql`
          SELECT id, name, grade, enrollment_date
          FROM students WHERE name ILIKE ${'%' + name + '%'} LIMIT 5
        `)
      ).rows;

      if (candidates.length === 0) return { found: false, message: `No student matching "${name}".` };
      if (candidates.length > 1) {
        return {
          found: false,
          ambiguous: true,
          message: 'Several students match; ask the user which one they mean.',
          options: candidates.map((s) => ({ name: s.name, grade: s.grade }))
        };
      }

      const student = candidates[0];
      const [logs, scores] = await Promise.all([
        db.execute(sql`
          SELECT tl.subject, tl.topic, tl.logged_at, tl.session_id, u.name AS volunteer_name
          FROM teaching_logs tl
          LEFT JOIN users u ON u.id = tl.volunteer_id
          WHERE tl.student_id = ${student.id}
          ORDER BY tl.logged_at DESC
          LIMIT 40
        `).then((r) => r.rows),
        db.execute(sql`
          SELECT subject, topic, score, max_score, taken_at
          FROM quiz_scores WHERE student_id = ${student.id}
          ORDER BY taken_at DESC LIMIT 10
        `).then((r) => r.rows)
      ]);

      const sessionsAttended = new Set(logs.map((l) => String(l.session_id))).size;
      const lastTaught = logs[0]?.logged_at || null;

      return {
        found: true,
        student: { name: student.name, grade: student.grade, enrolledOn: student.enrollment_date },
        sessionsAttended,
        lastTaught,
        daysSinceLastTaught: lastTaught ? Math.floor((Date.now() - new Date(lastTaught)) / 86400000) : null,
        recentLessons: logs.slice(0, 12).map((l) => ({
          date: l.logged_at,
          subject: l.subject,
          topic: l.topic,
          volunteer: l.volunteer_name || null
        })),
        quizScores: scores.map((q) => ({
          subject: q.subject,
          topic: q.topic,
          percent: Number(q.max_score) ? Math.round((Number(q.score) / Number(q.max_score)) * 100) : null,
          date: q.taken_at
        }))
      };
    }
  },

  {
    name: 'find_students_needing_attention',
    description:
      'Find students who may be falling behind: not taught for a while, or with low quiz ' +
      'averages. Optionally narrow by class or subject. Use this for questions like "who have ' +
      'we missed", "who is struggling in Math", or when planning whom to focus on.',
    parameters: {
      type: 'object',
      properties: {
        grade: { type: 'string', description: 'Restrict to one class, e.g. "Class 4"' },
        subject: { type: 'string', description: 'Restrict quiz analysis to one subject' },
        notTaughtForDays: {
          type: 'integer',
          description: 'Flag students with no lesson in this many days (default 21)'
        },
        lowScoreBelowPercent: {
          type: 'integer',
          description: 'Flag students whose average quiz score is below this (default 50)'
        }
      }
    },
    roles: ROLES.ALL,
    async run({ grade, subject, notTaughtForDays = 21, lowScoreBelowPercent = 50 }) {
      const db = getDb();
      const students = (
        grade
          ? await db.execute(sql`SELECT id, name, grade FROM students WHERE grade ILIKE ${'%' + grade + '%'}`)
          : await db.execute(sql`SELECT id, name, grade FROM students`)
      ).rows;
      if (students.length === 0) return { students: [], message: 'No students match.' };

      const ids = students.map((s) => s.id);
      // One round trip for everyone's last lesson.
      const lastLessons = (
        await db.execute(sql`
          SELECT student_id, MAX(logged_at) AS last_taught
          FROM teaching_logs WHERE student_id IN ${sql`(${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`}
          GROUP BY student_id
        `)
      ).rows;
      const lastTaughtById = new Map(lastLessons.map((r) => [String(r.student_id), r.last_taught]));

      // All quiz scores for the candidate set, filtered by subject in JS
      // (matches the original average-since-the-selected-subject logic).
      const allScores = (
        await db.execute(sql`
          SELECT student_id, subject, score, max_score
          FROM quiz_scores WHERE student_id IN ${sql`(${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`}
        `)
      ).rows;
      const scoresByStudent = new Map();
      for (const row of allScores) {
        const key = String(row.student_id);
        if (!scoresByStudent.has(key)) scoresByStudent.set(key, []);
        scoresByStudent.get(key).push(row);
      }

      const cutoff = daysAgo(notTaughtForDays);
      const subjectRe = subject ? new RegExp(subject, 'i') : null;

      const flagged = [];
      for (const s of students) {
        const reasons = [];
        const lastTaught = lastTaughtById.get(String(s.id)) || null;

        if (!lastTaught) reasons.push('never taught');
        else if (new Date(lastTaught) < cutoff) {
          reasons.push(`not taught for ${Math.floor((Date.now() - new Date(lastTaught)) / 86400000)} days`);
        }

        const scores = (scoresByStudent.get(String(s.id)) || []).filter(
          (q) => Number(q.max_score) && (!subjectRe || subjectRe.test(q.subject))
        );
        if (scores.length > 0) {
          const avg = Math.round(
            (scores.reduce((sum, q) => sum + Number(q.score) / Number(q.max_score), 0) / scores.length) * 100
          );
          if (avg < lowScoreBelowPercent) {
            reasons.push(`quiz average ${avg}%${subject ? ` in ${subject}` : ''}`);
          }
        }

        if (reasons.length) flagged.push({ name: s.name, grade: s.grade, lastTaught, reasons });
      }

      flagged.sort((a, b) => (a.lastTaught ? new Date(a.lastTaught).getTime() : 0) - (b.lastTaught ? new Date(b.lastTaught).getTime() : 0));
      return {
        checked: students.length,
        flagged: flagged.length,
        criteria: { notTaughtForDays, lowScoreBelowPercent, grade: grade || 'any', subject: subject || 'any' },
        students: flagged.slice(0, 25)
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------
  {
    name: 'list_sessions',
    description:
      'List teaching sessions. "live" = happening right now, "upcoming" = future, "past" = ' +
      'already finished. Includes how many volunteers registered and, for past sessions, how ' +
      'many lessons were logged. Use for "when is the next session", "what happened last Saturday".',
    parameters: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['live', 'upcoming', 'past'] },
        limit: { type: 'integer', description: 'Max sessions to return (default 5, max 20)' }
      },
      required: ['range']
    },
    roles: ROLES.ALL,
    async run({ range, limit = 5 }) {
      const db = getDb();
      const n = Math.min(Math.max(limit, 1), 20);

      const whereClause =
        range === 'live'
          ? sql`start_time <= now() AND end_time >= now()`
          : range === 'upcoming'
            ? sql`start_time > now()`
            : sql`end_time < now()`;
      const orderClause = range === 'past' ? sql`start_time DESC` : sql`start_time ASC`;

      const sessions = (
        await db.execute(sql`
          SELECT id, title, start_time, end_time FROM attendance_sessions
          WHERE ${whereClause} ORDER BY ${orderClause} LIMIT ${n}
        `)
      ).rows;
      if (sessions.length === 0) return { sessions: [] };

      const ids = sessions.map((s) => s.id);
      const idList = sql`(${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`;
      const [regs, logs] = await Promise.all([
        db
          .execute(sql`SELECT session_id, COUNT(*)::int AS count FROM registrations WHERE session_id IN ${idList} GROUP BY session_id`)
          .then((r) => r.rows),
        db
          .execute(sql`
            SELECT session_id, COUNT(*)::int AS lessons,
                   COUNT(DISTINCT student_id)::int AS students,
                   COUNT(DISTINCT volunteer_id)::int AS volunteers
            FROM teaching_logs WHERE session_id IN ${idList} GROUP BY session_id
          `)
          .then((r) => r.rows)
      ]);
      const regById = new Map(regs.map((r) => [String(r.session_id), r.count]));
      const logById = new Map(logs.map((r) => [String(r.session_id), r]));

      return {
        now: new Date(),
        sessions: sessions.map((s) => {
          const l = logById.get(String(s.id));
          return {
            title: s.title,
            startTime: s.start_time,
            endTime: s.end_time,
            volunteersRegistered: regById.get(String(s.id)) || 0,
            lessonsLogged: l?.lessons || 0,
            studentsTaught: l?.students || 0,
            volunteersWhoTaught: l?.volunteers || 0
          };
        })
      };
    }
  },

  // ---------------------------------------------------------------------------
  // The signed-in person. Scoped to ctx.user, never to a name the model picks.
  // ---------------------------------------------------------------------------
  {
    name: 'get_my_teaching_history',
    description:
      "The signed-in user's own teaching record: totals, their most recent lessons, AND a " +
      'per-student summary (what I taught each child, when I last saw them, their quiz average). ' +
      'Use for "what did I teach last time", "who have I been teaching", "what should I revise ' +
      'with my students". It already answers the per-student question — no further lookups needed.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Recent lessons to include (default 15, max 40)' }
      }
    },
    roles: ROLES.ALL,
    async run({ limit = 15 }, ctx) {
      const db = getDb();
      const n = Math.min(Math.max(limit, 1), 40);
      const volunteerId = ctx.user.id;

      const [recent, totalsRows, perStudentRows] = await Promise.all([
        db.execute(sql`
          SELECT tl.subject, tl.topic, tl.logged_at,
                 s.id AS student_id, s.name AS student_name, s.grade AS student_grade,
                 se.id AS session_id, se.title AS session_title
          FROM teaching_logs tl
          LEFT JOIN students s ON s.id = tl.student_id
          LEFT JOIN attendance_sessions se ON se.id = tl.session_id
          WHERE tl.volunteer_id = ${volunteerId}
          ORDER BY tl.logged_at DESC
          LIMIT ${n}
        `).then((r) => r.rows),
        db.execute(sql`
          SELECT COUNT(*)::int AS lessons,
                 COUNT(DISTINCT student_id)::int AS students,
                 COUNT(DISTINCT session_id)::int AS sessions,
                 ARRAY_AGG(DISTINCT subject) AS subjects
          FROM teaching_logs WHERE volunteer_id = ${volunteerId}
        `).then((r) => r.rows),
        // One row per child this volunteer has taught, most recent first.
        db.execute(sql`
          SELECT student_id, COUNT(*)::int AS lessons, MAX(logged_at) AS last_taught_by_me,
                 ARRAY_AGG(subject || ': ' || topic ORDER BY logged_at DESC) AS topics
          FROM teaching_logs WHERE volunteer_id = ${volunteerId}
          GROUP BY student_id
          ORDER BY MAX(logged_at) DESC
          LIMIT 30
        `).then((r) => r.rows)
      ]);

      const t = totalsRows[0];
      const studentIds = perStudentRows.map((r) => r.student_id);
      const [studentRows, scoreRows] =
        studentIds.length > 0
          ? await Promise.all([
              db
                .execute(sql`SELECT id, name, grade FROM students WHERE id IN ${sql`(${sql.join(studentIds.map((i) => sql`${i}::uuid`), sql`, `)})`}`)
                .then((r) => r.rows),
              db
                .execute(
                  sql`SELECT student_id, subject, score, max_score FROM quiz_scores WHERE student_id IN ${sql`(${sql.join(studentIds.map((i) => sql`${i}::uuid`), sql`, `)})`}`
                )
                .then((r) => r.rows)
            ])
          : [[], []];
      const studentById = new Map(studentRows.map((s) => [String(s.id), s]));
      const scoresByStudent = new Map();
      for (const row of scoreRows) {
        const key = String(row.student_id);
        if (!scoresByStudent.has(key)) scoresByStudent.set(key, []);
        scoresByStudent.get(key).push(row);
      }

      return {
        volunteer: ctx.user.name,
        totals: t && t.lessons > 0
          ? {
              lessons: t.lessons,
              distinctStudents: t.students,
              sessionsTaught: t.sessions,
              subjects: (t.subjects || []).filter(Boolean)
            }
          : { lessons: 0, distinctStudents: 0, sessionsTaught: 0, subjects: [] },
        recentLessons: recent.map((l) => ({
          date: l.logged_at,
          session: l.session_title || null,
          student: l.student_name || null,
          grade: l.student_grade || null,
          subject: l.subject,
          topic: l.topic
        })),
        myStudents: perStudentRows.map((r) => {
          const student = studentById.get(String(r.student_id));
          return {
            name: student?.name || null,
            grade: student?.grade || null,
            lessonsWithMe: r.lessons,
            lastTaughtByMe: r.last_taught_by_me,
            daysSince: Math.floor((Date.now() - new Date(r.last_taught_by_me)) / 86400000),
            recentTopicsWithMe: (r.topics || []).slice(0, 4),
            quizAveragePercent: quizAverage(
              (scoresByStudent.get(String(r.student_id)) || []).map((q) => ({ score: q.score, maxScore: q.max_score }))
            )
          };
        })
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Admin only. Volunteers are never told this tool exists.
  // ---------------------------------------------------------------------------
  {
    name: 'get_volunteer_stats',
    description:
      'Coordinator view of volunteers: a leaderboard of lessons taught in a period, or one ' +
      "volunteer's activity by name. Use for \"who taught the most\", \"has Rahul been active\", " +
      '"which volunteers went quiet".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A specific volunteer; omit for the leaderboard' },
        days: { type: 'integer', description: 'Look-back window in days (default 30)' },
        limit: { type: 'integer', description: 'Leaderboard size (default 10, max 25)' }
      }
    },
    roles: ROLES.ADMIN,
    async run({ name, days = 30, limit = 10 }) {
      const db = getDb();
      const since = daysAgo(days);

      const volunteers = (
        name
          ? await db.execute(sql`SELECT id, name FROM users WHERE role = 'volunteer' AND name ILIKE ${'%' + name + '%'}`)
          : await db.execute(sql`SELECT id, name FROM users WHERE role = 'volunteer'`)
      ).rows;
      if (volunteers.length === 0) return { volunteers: [], message: 'No volunteers match.' };

      const ids = volunteers.map((v) => v.id);
      const stats = (
        await db.execute(sql`
          SELECT volunteer_id, COUNT(*)::int AS lessons,
                 COUNT(DISTINCT student_id)::int AS students,
                 COUNT(DISTINCT session_id)::int AS sessions,
                 MAX(logged_at) AS last_taught
          FROM teaching_logs
          WHERE volunteer_id IN ${sql`(${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`} AND logged_at >= ${since}
          GROUP BY volunteer_id
        `)
      ).rows;
      const byId = new Map(stats.map((s) => [String(s.volunteer_id), s]));

      const rows = volunteers
        .map((v) => {
          const s = byId.get(String(v.id));
          return {
            name: v.name,
            lessons: s?.lessons || 0,
            distinctStudents: s?.students || 0,
            sessionsTaught: s?.sessions || 0,
            lastTaught: s?.last_taught || null
          };
        })
        .sort((a, b) => b.lessons - a.lessons);

      return {
        periodDays: days,
        totalVolunteers: volunteers.length,
        inactiveInPeriod: rows.filter((r) => r.lessons === 0).length,
        volunteers: rows.slice(0, Math.min(Math.max(limit, 1), 25))
      };
    }
  }
];

/** Tools this role is allowed to see and call. */
const toolsForRole = (role) => tools.filter((t) => t.roles.includes(role));

/** OpenAI `tools` array for the given role. */
const toolSchemasForRole = (role) =>
  toolsForRole(role).map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }));

module.exports = { tools, toolsForRole, toolSchemasForRole, normaliseSubject };
