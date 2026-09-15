/**
 * Rebuilds the club's records as a term of real use.
 *
 * Sankalp teaches on Saturdays and Sundays only, and started in August 2026.
 * This script clears the demo data and writes a plausible history from the
 * first weekend of August up to (but never past) the current date.
 *
 *   npm run seed-club-data
 *
 * Accounts that have signed in with Google are treated as real club members
 * and are never touched — only their teaching history is rebuilt.
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { eq, isNull, isNotNull } = require('drizzle-orm');

const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { users, students, attendanceSessions, registrations, teachingLogs, quizScores } = require('../db/schema');
const { parseGradeNumber } = require('../utils/grade');

// The term being reconstructed. Nothing is written after TODAY.
const TERM_START = new Date('2026-08-01T00:00:00+05:30');
const TODAY = new Date();

// Village school, ~10am to 1pm on weekend mornings.
const SESSION_START_HOUR = 10;
const SESSION_HOURS = 3;
const SCHOOL = { lat: 26.933531637176955, lng: 75.9162266441557 };

// Independence Day — the school holds its own flag ceremony, so the club
// skipped that weekend. A real calendar has gaps in it.
const SKIPPED = ['2026-08-15'];

// Seeded volunteers sign in with this. They exist to make the register look
// lived-in; the club's real members sign in with Google.
const DEMO_PASSWORD = 'Sankalp@2026';

// --- deterministic randomness, so re-running produces the same term ---------
let rngState = 20260811;
const rand = () => {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const chance = (p) => rand() < p;

const shuffled = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const code = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(rand() * chars.length)]).join('');
};

// --- the people -------------------------------------------------------------

// LNMIIT students who volunteer. Roll numbers avoid the real accounts already
// in the database.
const VOLUNTEERS = [
  ['Aditya Joshi', '23ucc501'],
  ['Ishita Agarwal', '23ucs512'],
  ['Karan Vyas', '23uec528'],
  ['Sneha Rathore', '24ucc233'],
  ['Rahul Choudhary', '24ucs241'],
  ['Prachi Mehta', '24uec259'],
  ['Nikhil Bhargava', '24ucc276'],
  ['Ananya Tiwari', '25ucc118'],
  ['Devansh Purohit', '25ucs134'],
  ['Riya Khandelwal', '25uec147'],
  ['Harsh Somani', '25ucc162'],
  ['Tanvi Bhatnagar', '25ucs173'],
  ['Yash Sisodia', '25uec189'],
  ['Manasi Kulkarni', '25ucc194'],
];

// Children from the villages around Jamdoli, with surnames common there.
const STUDENTS = [
  ['Aarti Meena', 'Class 5'], ['Rohit Gurjar', 'Class 4'],
  ['Sunita Bairwa', 'Class 6'], ['Kailash Saini', 'Class 3'],
  ['Pooja Yadav', 'Class 7'], ['Mahesh Jat', 'Class 5'],
  ['Nisha Sharma', 'Class 8'], ['Deepak Kumawat', 'Class 4'],
  ['Manju Regar', 'Class 2'], ['Sanjay Meena', 'Class 6'],
  ['Kavita Mali', 'Class 3'], ['Ramesh Prajapat', 'Class 7'],
  ['Anita Gurjar', 'Class 5'], ['Vikram Bairwa', 'Class 8'],
  ['Sarita Nai', 'Class 2'], ['Dinesh Choudhary', 'Class 4'],
  ['Rekha Meena', 'Class 6'], ['Mukesh Saini', 'Class 1'],
  ['Priya Jat', 'Class 5'], ['Gopal Banjara', 'Class 3'],
  ['Seema Kumawat', 'Class 7'], ['Naresh Mali', 'Class 4'],
  ['Lalita Gurjar', 'Class 2'], ['Hemant Meena', 'Class 8'],
  ['Babita Regar', 'Class 6'], ['Suresh Yadav', 'Class 1'],
  ['Kamla Bairwa', 'Class 3'], ['Arjun Prajapat', 'Class 5'],
  ['Meena Saini', 'Class 4'], ['Bhagwan Meena', 'Class 7'],
  ['Radha Choudhary', 'Class 2'], ['Om Prakash Jat', 'Class 6'],
  ['Sushila Nai', 'Class 1'], ['Jitendra Gurjar', 'Class 8'],
];

// Topics that suit the class being taught, so the register reads like a real
// syllabus rather than random strings.
const CURRICULUM = {
  Maths: {
    junior: ['Counting to 100', 'Number names', 'Addition without carry', 'Shapes around us', 'Bigger and smaller'],
    middle: ['Addition with carry', 'Subtraction with borrowing', 'Multiplication tables', 'Division basics', 'Measuring length'],
    senior: ['Fractions', 'Decimals', 'Long division', 'Perimeter and area', 'Simple interest', 'Ratio and proportion'],
  },
  Hindi: {
    junior: ['Varnamala', 'Matras', 'Sada shabd', 'Chitra varnan'],
    middle: ['Vilom shabd', 'Paryayvachi', 'Vakya rachna', 'Padhna abhyas'],
    senior: ['Muhavare', 'Kahani lekhan', 'Patra lekhan', 'Sangya aur sarvanam'],
  },
  English: {
    junior: ['The alphabet', 'Phonics', 'Naming words', 'Rhymes'],
    middle: ['Simple sentences', 'Reading practice', 'Action words', 'Opposites'],
    senior: ['Tenses', 'Letter writing', 'Comprehension', 'Story reading'],
  },
  Science: {
    junior: ['Parts of a plant', 'Our body', 'Animals around us', 'Day and night'],
    middle: ['The water cycle', 'Food we eat', 'Air and water', 'Weather'],
    senior: ['States of matter', 'The solar system', 'Food chains', 'Simple machines', 'Light and shadow'],
  },
  'Social Studies': {
    junior: ['Our village', 'My family', 'Festivals we celebrate'],
    middle: ['Maps and directions', 'Rajasthan we live in', 'Our neighbourhood'],
    senior: ['Freedom fighters', 'Our Constitution', 'Rivers of India', 'Local government'],
  },
};

const bandFor = (grade) => {
  const n = Number(String(grade).replace(/\D/g, '')) || 5;
  if (n <= 2) return 'junior';
  if (n <= 5) return 'middle';
  return 'senior';
};

// --- calendar ---------------------------------------------------------------

// Local calendar date. toISOString() would shift IST midnight back a day and
// land the holiday skip on the wrong weekend.
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

function weekendsInTerm() {
  const days = [];
  const cursor = new Date(TERM_START);

  while (cursor <= TODAY) {
    const day = cursor.getDay(); // 0 Sun, 6 Sat
    if ((day === 0 || day === 6) && !SKIPPED.includes(isoDay(cursor))) {
      const start = new Date(cursor);
      start.setHours(SESSION_START_HOUR, 0, 0, 0);
      // Never write a session that has not happened yet.
      if (start < TODAY) days.push(start);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const titleFor = (date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const day = date.toLocaleDateString('en-IN', { weekday: 'long' });
  return `${dd}.${mm}.${yy}.${day}`;
};

// A phone that the family actually shares; plenty do not.
const phone = () => (chance(0.62) ? `9${between(1, 9)}${String(between(10000000, 99999999))}` : '');

// Coordinates jittered around the school, as a real GPS fix would be.
const nearSchool = () => ({
  lat: SCHOOL.lat + (rand() - 0.5) * 0.0016,
  lng: SCHOOL.lng + (rand() - 0.5) * 0.0016,
});

async function seed() {
  await connectPG();
  const db = getDb();
  console.log('Connected to PostgreSQL\n');

  // --- clear, preserving real sign-ins -------------------------------------
  const realMembers = await db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(isNotNull(users.googleId));

  // Children before the parents they reference; non-Google users deleted last.
  await db.delete(teachingLogs);
  await db.delete(registrations);
  await db.delete(attendanceSessions);
  await db.delete(students); // quiz_scores cascade with their student
  const removedUsers = await db.delete(users).where(isNull(users.googleId)).returning({ id: users.id });

  console.log(`Cleared demo data. Removed ${removedUsers.length} seeded accounts.`);
  console.log(`Preserved ${realMembers.length} real members who sign in with Google:`);
  realMembers.forEach((m) => console.log(`   ${m.role.padEnd(10)} ${m.email}`));
  console.log('');

  // --- volunteers -----------------------------------------------------------
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  const volunteerDocs = await db
    .insert(users)
    .values(
      VOLUNTEERS.map(([name, roll]) => ({
        name,
        email: `${roll}@lnmiit.ac.in`,
        passwordHash: hashed,
        role: 'volunteer',
        phone: `9${between(1, 9)}${String(between(10000000, 99999999))}`,
      }))
    )
    .returning();

  // Real members teach too, so the register is not made only of seeded people.
  const realTeaching = await db.select({ id: users.id }).from(users).where(isNotNull(users.googleId));
  const teachers = [...volunteerDocs, ...realTeaching];
  const [adminRow] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')).limit(1);
  const admin = adminRow || volunteerDocs[0];

  console.log(`Created ${volunteerDocs.length} volunteer accounts.`);

  // --- students -------------------------------------------------------------
  // Most enrolled as the club started; a few joined as word spread.
  const studentDocs = await db
    .insert(students)
    .values(
      STUDENTS.map(([name, grade], i) => {
        const joinedLate = i >= STUDENTS.length - 7;
        const enrolled = new Date(TERM_START);
        enrolled.setDate(enrolled.getDate() - (joinedLate ? -between(14, 33) : between(2, 9)));
        return { name, grade, gradeNumber: parseGradeNumber(grade), parentPhone: phone(), enrollmentDate: enrolled };
      })
    )
    .returning();
  console.log(`Enrolled ${studentDocs.length} students.`);

  // --- the term -------------------------------------------------------------
  const weekends = weekendsInTerm();

  // Volunteer commitment varies: a core group turns up nearly every weekend,
  // others fade, a few only join later in the term.
  const commitment = teachers.map((t, i) => ({
    id: t.id,
    reliability: i < 5 ? 0.85 + rand() * 0.12 : i < 10 ? 0.45 + rand() * 0.3 : 0.15 + rand() * 0.3,
    joinsAt: i >= teachers.length - 3 ? between(4, 7) : 0,
  }));

  // Likewise for children: some never miss, some drift in and out.
  const regularity = studentDocs.map((s, i) => ({
    id: s.id,
    grade: s.grade,
    rate: i % 7 === 0 ? 0.35 + rand() * 0.2 : 0.6 + rand() * 0.35,
  }));

  const sessionRows = [];
  const registrationRows = [];
  const logRows = [];

  // A child works through a subject rather than being taught the same topic
  // over and over, so each (student, subject) walks its syllabus in order and
  // only occasionally goes back over something.
  const progress = new Map();
  const nextTopic = (child, subject) => {
    const list = CURRICULUM[subject][bandFor(child.grade)];
    const key = `${child.id}:${subject}`;
    const done = progress.get(key) || 0;

    if (done > 0 && chance(0.22)) {
      // Revision of something already covered.
      return list[between(0, Math.min(done, list.length) - 1)];
    }

    progress.set(key, done + 1);
    return list[done % list.length];
  };

  weekends.forEach((start, index) => {
    const end = new Date(start);
    end.setHours(start.getHours() + SESSION_HOURS);

    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      title: titleFor(start),
      startTime: start,
      endTime: end,
      lat: SCHOOL.lat,
      lng: SCHOOL.lng,
      activeCode: null,
      codeExpiry: null,
      createdBy: admin.id,
      createdAt: new Date(start.getTime() - between(2, 5) * 3600 * 1000),
      updatedAt: end,
    };
    sessionRows.push(session);

    // Who showed up. Turnout builds a little over the first few weekends.
    const momentum = Math.min(1, 0.62 + index * 0.05);
    const present = commitment.filter(
      (v) => index >= v.joinsAt && chance(v.reliability * momentum)
    );

    // A weekend where hardly anyone could come still gets a couple of people.
    const attending = present.length >= 3 ? present : shuffled(commitment).slice(0, between(3, 5));

    attending.forEach((v) => {
      registrationRows.push({
        userId: v.id,
        sessionId,
        createdAt: new Date(start.getTime() - between(1, 96) * 3600 * 1000),
        updatedAt: start,
      });
    });

    // Children present this weekend, shared out so nobody is taught the same
    // thing twice.
    const childrenHere = shuffled(regularity.filter((s) => chance(s.rate)));
    let cursor = 0;

    // (volunteer, student) pairs already used this session — the unique index
    // on the table forbids repeats.
    const taken = new Set();

    const record = (volunteerId, child, avoidSubject) => {
      const key = `${volunteerId}:${child.id}`;
      if (taken.has(key)) return;
      taken.add(key);

      const choices = ['Maths', 'Maths', 'Hindi', 'English', 'Science', 'Social Studies'].filter(
        (s) => s !== avoidSubject
      );
      const subject = pick(choices);
      const topic = nextTopic(child, subject);
      const at = new Date(start.getTime() + between(18, 160) * 60 * 1000);
      const where = nearSchool();

      logRows.push({
        volunteerId,
        sessionId,
        studentId: child.id,
        subject,
        topic,
        loggedAt: at,
        codeUsed: code(),
        lat: where.lat,
        lng: where.lng,
        createdAt: at,
        updatedAt: at,
      });

      return subject;
    };

    const taughtToday = [];
    attending.forEach((v) => {
      const load = between(2, 4);
      const mine = childrenHere.slice(cursor, cursor + load);
      cursor += load;
      mine.forEach((child) => {
        const subject = record(v.id, child);
        taughtToday.push({ child, subject, by: v.id });
      });
    });

    // Some children sit with a second volunteer for another subject before the
    // session ends, so lessons outnumber the children reached — as they do in
    // a real three-hour morning.
    taughtToday.forEach(({ child, subject, by }) => {
      if (!chance(0.18)) return;
      const other = pick(attending.filter((v) => String(v.id) !== String(by)));
      if (other) record(other.id, child, subject);
    });
  });

  if (sessionRows.length > 0) await db.insert(attendanceSessions).values(sessionRows);
  if (registrationRows.length > 0) await db.insert(registrations).values(registrationRows);
  if (logRows.length > 0) await db.insert(teachingLogs).values(logRows);

  console.log(`\nWrote ${sessionRows.length} weekend sessions:`);
  sessionRows.forEach((s) => {
    const taught = logRows.filter((l) => String(l.sessionId) === String(s.id));
    const volunteers = new Set(taught.map((l) => String(l.volunteerId))).size;
    const children = new Set(taught.map((l) => String(l.studentId))).size;
    console.log(
      `   ${s.title.padEnd(22)} ${String(volunteers).padStart(2)} volunteers  ` +
        `${String(children).padStart(2)} children  ${String(taught.length).padStart(3)} lessons`
    );
  });

  // --- quiz scores ----------------------------------------------------------
  // Coordinators test a topic every few weeks, not after every lesson.
  let quizzed = 0;
  const quizRows = [];
  for (const student of studentDocs) {
    if (!chance(0.55)) continue;

    const taughtSubjects = [
      ...new Set(
        logRows.filter((l) => String(l.studentId) === String(student.id)).map((l) => l.subject)
      ),
    ];
    if (taughtSubjects.length === 0) continue;

    const scores = [];
    for (let i = 0; i < between(1, 3); i += 1) {
      const subject = pick(taughtSubjects);
      const maxScore = pick([10, 10, 20]);
      const date = new Date(
        TERM_START.getTime() + between(9, Math.max(10, Math.floor((TODAY - TERM_START) / 86400000))) * 86400000
      );
      if (date > TODAY) continue;

      scores.push({
        subject,
        topic: pick(CURRICULUM[subject][bandFor(student.grade)]),
        // Most children pass; a few are still finding their feet.
        score: Math.min(maxScore, Math.round(maxScore * (0.35 + rand() * 0.6))),
        maxScore,
        date,
      });
    }

    if (scores.length > 0) {
      scores.sort((a, b) => a.date - b.date);
      scores.forEach((q) =>
        quizRows.push({ studentId: student.id, subject: q.subject, topic: q.topic, score: String(q.score), maxScore: String(q.maxScore), takenAt: q.date })
      );
      quizzed += 1;
    }
  }
  if (quizRows.length > 0) await db.insert(quizScores).values(quizRows);

  console.log(`\nRecorded quiz scores for ${quizzed} students.`);
  console.log(`Total: ${logRows.length} lessons across ${sessionRows.length} sessions.`);
  console.log(`\nSeeded volunteers sign in with: ${DEMO_PASSWORD}`);
  console.log('Real members keep using Google sign-in.');

  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
