// Draft a session-prep plan for every volunteer registered for the next
// upcoming session. This is the "proactive" half of the workflow — the thing a
// scheduler runs on Friday evening so plans are waiting when volunteers open
// the app. Idempotent: volunteers who already have a draft are skipped.
//
//   npm run prep-next-session            # next session that has not ended
//   npm run prep-next-session -- <id>    # a specific session
//
require('dotenv').config();

const { eq, gt, inArray, asc } = require('drizzle-orm');
const { connectPG } = require('../db/pool');
const { getDb } = require('../db');
const { attendanceSessions, registrations, users } = require('../db/schema');
const { prepareSession } = require('../services/sessionPrepService');
const { CHAT_PROVIDER, CHAT_MODEL, isConfigured, notConfiguredMessage } = require('../services/llmClient');

async function main() {
  if (!isConfigured()) {
    console.error(notConfiguredMessage());
    process.exit(1);
  }
  await connectPG();
  const db = getDb();

  const requestedId = process.argv[2];
  let session;
  if (requestedId) {
    [session] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, requestedId)).limit(1);
  } else {
    [session] = await db
      .select()
      .from(attendanceSessions)
      .where(gt(attendanceSessions.endTime, new Date()))
      .orderBy(asc(attendanceSessions.startTime))
      .limit(1);
  }

  if (!session) {
    console.log('No upcoming session to prepare for.');
    process.exit(0);
  }

  const regs = await db.select({ userId: registrations.userId }).from(registrations).where(eq(registrations.sessionId, session.id));
  const volunteers = regs.length
    ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.id, regs.map((r) => r.userId)))
    : [];

  console.log(`Session: ${session.title} (${new Date(session.startTime).toLocaleString('en-IN')})`);
  console.log(`Registered volunteers: ${volunteers.length}. Model: ${CHAT_PROVIDER}/${CHAT_MODEL}\n`);

  let drafted = 0, skipped = 0, failed = 0;
  // Sequential: free-tier providers throttle per minute.
  for (const volunteer of volunteers) {
    const t0 = Date.now();
    try {
      const { draft, created } = await prepareSession({ session, volunteer });
      if (created) {
        drafted += 1;
        const groups = draft.focusGroups.map((g) => `${g.subject}: ${g.topic} (${g.students.length})`).join('; ');
        console.log(`  ✓ ${volunteer.name.padEnd(22)} ${Date.now() - t0}ms  ${groups}`);
      } else {
        skipped += 1;
        console.log(`  – ${volunteer.name.padEnd(22)} already has a ${draft.status} plan`);
      }
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${volunteer.name.padEnd(22)} ${err.message}`);
    }
  }

  console.log(`\nDrafted ${drafted}, skipped ${skipped}, failed ${failed}.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
