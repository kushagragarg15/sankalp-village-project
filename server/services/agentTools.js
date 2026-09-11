const Student = require('../models/Student');
const User = require('../models/User');
const TeachingLog = require('../models/TeachingLog');
const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');
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
 * system prompt in agentService.js says so explicitly, and tool results are
 * wrapped in a clearly labelled block before they are handed back.
 */

const ROLES = { ALL: ['admin', 'volunteer'], ADMIN: ['admin'] };

// User-typed names go into regexes; a stray "(" must not turn into a syntax error.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameRegex = (name) => new RegExp(escapeRegex(name.trim()), 'i');

// Teaching logs say "Maths", the resource library says "Math"; the model may use either.
const normaliseSubject = (s) => String(s || '').trim().replace(/^maths$/i, 'Math');

const daysAgo = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
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
      // Threshold left to the embedding model's default (see llmClient).
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
      const candidates = await Student.find({ name: nameRegex(name) })
        .select('name grade enrollmentDate quizScores')
        .limit(5)
        .lean();

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
      const logs = await TeachingLog.find({ studentId: student._id })
        .populate('volunteerId', 'name')
        .sort({ timestamp: -1 })
        .limit(40)
        .select('subject topic timestamp sessionId volunteerId')
        .lean();

      const sessionsAttended = new Set(logs.map((l) => String(l.sessionId))).size;
      const lastTaught = logs[0]?.timestamp || null;

      return {
        found: true,
        student: { name: student.name, grade: student.grade, enrolledOn: student.enrollmentDate },
        sessionsAttended,
        lastTaught,
        daysSinceLastTaught: lastTaught
          ? Math.floor((Date.now() - new Date(lastTaught)) / 86400000)
          : null,
        recentLessons: logs.slice(0, 12).map((l) => ({
          date: l.timestamp,
          subject: l.subject,
          topic: l.topic,
          volunteer: l.volunteerId?.name || null
        })),
        quizScores: (student.quizScores || [])
          .slice(-10)
          .map((q) => ({
            subject: q.subject,
            topic: q.topic,
            percent: q.maxScore ? Math.round((q.score / q.maxScore) * 100) : null,
            date: q.date
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
      const filter = grade ? { grade: nameRegex(grade) } : {};
      const students = await Student.find(filter).select('name grade quizScores').lean();
      if (students.length === 0) return { students: [], message: 'No students match.' };

      // One round trip for everyone's last lesson, rather than one per student.
      const lastLessons = await TeachingLog.aggregate([
        { $match: { studentId: { $in: students.map((s) => s._id) } } },
        { $group: { _id: '$studentId', lastTaught: { $max: '$timestamp' } } }
      ]);
      const lastTaughtById = new Map(lastLessons.map((r) => [String(r._id), r.lastTaught]));

      const cutoff = daysAgo(notTaughtForDays);
      const subjectRe = subject ? nameRegex(subject) : null;

      const flagged = [];
      for (const s of students) {
        const reasons = [];
        const lastTaught = lastTaughtById.get(String(s._id)) || null;

        if (!lastTaught) reasons.push('never taught');
        else if (lastTaught < cutoff) {
          reasons.push(`not taught for ${Math.floor((Date.now() - lastTaught) / 86400000)} days`);
        }

        const scores = (s.quizScores || []).filter(
          (q) => q.maxScore && (!subjectRe || subjectRe.test(q.subject))
        );
        if (scores.length > 0) {
          const avg = Math.round(
            (scores.reduce((sum, q) => sum + q.score / q.maxScore, 0) / scores.length) * 100
          );
          if (avg < lowScoreBelowPercent) {
            reasons.push(`quiz average ${avg}%${subject ? ` in ${subject}` : ''}`);
          }
        }

        if (reasons.length) flagged.push({ name: s.name, grade: s.grade, lastTaught, reasons });
      }

      flagged.sort((a, b) => (a.lastTaught || 0) - (b.lastTaught || 0));
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
      const now = new Date();
      const n = Math.min(Math.max(limit, 1), 20);
      const query =
        range === 'live'
          ? { startTime: { $lte: now }, endTime: { $gte: now } }
          : range === 'upcoming'
            ? { startTime: { $gt: now } }
            : { endTime: { $lt: now } };

      const sessions = await AttendanceSession.find(query)
        .sort({ startTime: range === 'past' ? -1 : 1 })
        .limit(n)
        .select('title startTime endTime')
        .lean();
      if (sessions.length === 0) return { sessions: [] };

      const ids = sessions.map((s) => s._id);
      const [regs, logs] = await Promise.all([
        Registration.aggregate([
          { $match: { sessionId: { $in: ids } } },
          { $group: { _id: '$sessionId', count: { $sum: 1 } } }
        ]),
        TeachingLog.aggregate([
          { $match: { sessionId: { $in: ids } } },
          {
            $group: {
              _id: '$sessionId',
              lessons: { $sum: 1 },
              students: { $addToSet: '$studentId' },
              volunteers: { $addToSet: '$volunteerId' }
            }
          }
        ])
      ]);
      const regById = new Map(regs.map((r) => [String(r._id), r.count]));
      const logById = new Map(logs.map((r) => [String(r._id), r]));

      return {
        now,
        sessions: sessions.map((s) => {
          const l = logById.get(String(s._id));
          return {
            title: s.title,
            startTime: s.startTime,
            endTime: s.endTime,
            volunteersRegistered: regById.get(String(s._id)) || 0,
            lessonsLogged: l?.lessons || 0,
            studentsTaught: l?.students.length || 0,
            volunteersWhoTaught: l?.volunteers.length || 0
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
      const n = Math.min(Math.max(limit, 1), 40);
      const [recent, totals, perStudent] = await Promise.all([
        TeachingLog.find({ volunteerId: ctx.user._id })
          .populate('studentId', 'name grade')
          .populate('sessionId', 'title startTime')
          .sort({ timestamp: -1 })
          .limit(n)
          .select('subject topic timestamp studentId sessionId')
          .lean(),
        TeachingLog.aggregate([
          { $match: { volunteerId: ctx.user._id } },
          {
            $group: {
              _id: null,
              lessons: { $sum: 1 },
              students: { $addToSet: '$studentId' },
              sessions: { $addToSet: '$sessionId' },
              subjects: { $addToSet: '$subject' }
            }
          }
        ]),
        // One row per child this volunteer has taught, with what and when.
        TeachingLog.aggregate([
          { $match: { volunteerId: ctx.user._id } },
          { $sort: { timestamp: -1 } },
          {
            $group: {
              _id: '$studentId',
              lessons: { $sum: 1 },
              lastTaughtByMe: { $first: '$timestamp' },
              topics: { $push: { $concat: ['$subject', ': ', '$topic'] } }
            }
          },
          { $sort: { lastTaughtByMe: -1 } },
          { $limit: 30 },
          { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
          { $unwind: '$student' },
          {
            $project: {
              name: '$student.name',
              grade: '$student.grade',
              lessons: 1,
              lastTaughtByMe: 1,
              topics: { $slice: ['$topics', 4] },
              quizScores: '$student.quizScores'
            }
          }
        ])
      ]);
      const t = totals[0];

      const quizAverage = (scores) => {
        const valid = (scores || []).filter((q) => q.maxScore);
        if (valid.length === 0) return null;
        return Math.round((valid.reduce((sum, q) => sum + q.score / q.maxScore, 0) / valid.length) * 100);
      };
      return {
        volunteer: ctx.user.name,
        totals: t
          ? {
              lessons: t.lessons,
              distinctStudents: t.students.length,
              sessionsTaught: t.sessions.length,
              subjects: t.subjects
            }
          : { lessons: 0, distinctStudents: 0, sessionsTaught: 0, subjects: [] },
        recentLessons: recent.map((l) => ({
          date: l.timestamp,
          session: l.sessionId?.title || null,
          student: l.studentId?.name || null,
          grade: l.studentId?.grade || null,
          subject: l.subject,
          topic: l.topic
        })),
        myStudents: perStudent.map((r) => ({
          name: r.name,
          grade: r.grade,
          lessonsWithMe: r.lessons,
          lastTaughtByMe: r.lastTaughtByMe,
          daysSince: Math.floor((Date.now() - new Date(r.lastTaughtByMe)) / 86400000),
          recentTopicsWithMe: r.topics,
          quizAveragePercent: quizAverage(r.quizScores)
        }))
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
      const since = daysAgo(days);
      const volunteerFilter = { role: 'volunteer' };
      if (name) volunteerFilter.name = nameRegex(name);

      const volunteers = await User.find(volunteerFilter).select('name createdAt').lean();
      if (volunteers.length === 0) return { volunteers: [], message: 'No volunteers match.' };

      const stats = await TeachingLog.aggregate([
        { $match: { volunteerId: { $in: volunteers.map((v) => v._id) }, timestamp: { $gte: since } } },
        {
          $group: {
            _id: '$volunteerId',
            lessons: { $sum: 1 },
            students: { $addToSet: '$studentId' },
            sessions: { $addToSet: '$sessionId' },
            lastTaught: { $max: '$timestamp' }
          }
        }
      ]);
      const byId = new Map(stats.map((s) => [String(s._id), s]));

      const rows = volunteers
        .map((v) => {
          const s = byId.get(String(v._id));
          return {
            name: v.name,
            lessons: s?.lessons || 0,
            distinctStudents: s?.students.length || 0,
            sessionsTaught: s?.sessions.length || 0,
            lastTaught: s?.lastTaught || null
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

module.exports = { tools, toolsForRole, toolSchemasForRole };
