const { eq, desc, lte, count, sql } = require('drizzle-orm');
const { getDb } = require('../db');
const { students, quizScores, teachingLogs, attendanceSessions, users } = require('../db/schema');
const { withId, withIds } = require('../db/serialize');
const { parseGradeNumber } = require('../utils/grade');

const studentWithQuizzes = async (db, id) => {
  const [student] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!student) return null;
  const scores = await db
    .select()
    .from(quizScores)
    .where(eq(quizScores.studentId, id))
    .orderBy(quizScores.takenAt);
  return {
    ...withId(student),
    quizScores: scores.map((q) => ({
      subject: q.subject,
      topic: q.topic,
      score: Number(q.score),
      maxScore: Number(q.maxScore),
      date: q.takenAt
    }))
  };
};

// @desc    Get all students
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.select().from(students);
    res.status(200).json({ success: true, count: rows.length, data: withIds(rows) });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
exports.getStudent = async (req, res, next) => {
  try {
    const db = getDb();
    const data = await studentWithQuizzes(db, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student progress
// @route   GET /api/students/:id/progress
// @access  Private
exports.getStudentProgress = async (req, res, next) => {
  try {
    const db = getDb();
    const [student] = await db.select().from(students).where(eq(students.id, req.params.id)).limit(1);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const [logs, [totalRow], scores] = await Promise.all([
      db
        .select({
          subject: teachingLogs.subject,
          topic: teachingLogs.topic,
          loggedAt: teachingLogs.loggedAt,
          sessionId: attendanceSessions.id,
          sessionTitle: attendanceSessions.title,
          sessionStartTime: attendanceSessions.startTime,
          volunteerName: users.name
        })
        .from(teachingLogs)
        .leftJoin(attendanceSessions, eq(teachingLogs.sessionId, attendanceSessions.id))
        .leftJoin(users, eq(teachingLogs.volunteerId, users.id))
        .where(eq(teachingLogs.studentId, student.id))
        .orderBy(desc(teachingLogs.loggedAt)),
      db.select({ total: count() }).from(attendanceSessions).where(lte(attendanceSessions.endTime, sql`now()`)),
      db.select().from(quizScores).where(eq(quizScores.studentId, student.id)).orderBy(quizScores.takenAt)
    ]);
    const totalSessions = totalRow.total;

    const sessionsAttended = new Set(logs.filter((l) => l.sessionId).map((l) => l.sessionId)).size;

    const topicsCovered = {};
    for (const log of logs) {
      (topicsCovered[log.subject] = topicsCovered[log.subject] || []).push({
        topic: log.topic,
        date: log.loggedAt,
        volunteer: log.volunteerName
      });
    }

    const percentage = totalSessions > 0 ? Math.round((sessionsAttended / totalSessions) * 100) : 0;

    const seenSessions = new Map();
    for (const log of logs) {
      if (log.sessionId && !seenSessions.has(log.sessionId)) {
        seenSessions.set(log.sessionId, {
          _id: log.sessionId,
          id: log.sessionId,
          title: log.sessionTitle,
          startTime: log.sessionStartTime
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          grade: student.grade,
          enrollmentDate: student.enrollmentDate
        },
        attendance: {
          eventsAttended: sessionsAttended,
          totalEvents: totalSessions,
          percentage
        },
        topicsCovered,
        quizScores: scores.map((q) => ({
          subject: q.subject,
          topic: q.topic,
          score: Number(q.score),
          maxScore: Number(q.maxScore),
          date: q.takenAt
        })),
        recentSessions: [...seenSessions.values()].slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private
exports.createStudent = async (req, res, next) => {
  try {
    const { name, grade, enrollmentDate, parentPhone } = req.body;

    if (!name || !grade) {
      return res.status(400).json({ success: false, message: 'Student name and grade/class are required' });
    }

    const db = getDb();
    const [student] = await db
      .insert(students)
      .values({
        name,
        grade,
        gradeNumber: parseGradeNumber(grade),
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : undefined,
        parentPhone: parentPhone || ''
      })
      .returning();

    res.status(201).json({ success: true, data: withId(student) });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
exports.updateStudent = async (req, res, next) => {
  try {
    // Explicit allowlist — replaces `findByIdAndUpdate(req.body)`.
    const patch = {};
    if (typeof req.body.name === 'string') patch.name = req.body.name;
    if (typeof req.body.grade === 'string') {
      patch.grade = req.body.grade;
      patch.gradeNumber = parseGradeNumber(req.body.grade);
    }
    if (typeof req.body.parentPhone === 'string') patch.parentPhone = req.body.parentPhone;
    if (req.body.enrollmentDate) patch.enrollmentDate = new Date(req.body.enrollmentDate);

    const db = getDb();
    if (Object.keys(patch).length === 0) {
      const [existing] = await db.select().from(students).where(eq(students.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ success: false, message: 'Student not found' });
      return res.status(200).json({ success: true, data: withId(existing) });
    }

    const [student] = await db.update(students).set(patch).where(eq(students.id, req.params.id)).returning();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, data: withId(student) });
  } catch (error) {
    next(error);
  }
};

// @desc    Add quiz score to student
// @route   POST /api/students/:id/quiz-score
// @access  Private
exports.addQuizScore = async (req, res, next) => {
  try {
    const { subject, topic } = req.body;
    const score = Number(req.body.score);
    const maxScore = Number(req.body.maxScore);

    if (!subject || !topic) {
      return res.status(400).json({ success: false, message: 'Subject and topic are required' });
    }

    if (!Number.isFinite(score) || !Number.isFinite(maxScore)) {
      return res.status(400).json({ success: false, message: 'Score and total must be numbers' });
    }

    if (maxScore <= 0) {
      return res.status(400).json({ success: false, message: 'The total must be greater than zero' });
    }

    if (score < 0 || score > maxScore) {
      return res.status(400).json({ success: false, message: `Score must be between 0 and ${maxScore}` });
    }

    const db = getDb();
    const [student] = await db.select({ id: students.id }).from(students).where(eq(students.id, req.params.id)).limit(1);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await db.insert(quizScores).values({ studentId: student.id, subject, topic, score: String(score), maxScore: String(maxScore), takenAt: new Date() });

    const data = await studentWithQuizzes(db, student.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res, next) => {
  try {
    const db = getDb();
    const [student] = await db.delete(students).where(eq(students.id, req.params.id)).returning({ id: students.id });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    next(error);
  }
};
