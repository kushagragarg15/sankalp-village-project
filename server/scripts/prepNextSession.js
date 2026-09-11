// Draft a session-prep plan for every volunteer registered for the next
// upcoming session. This is the "proactive" half of the workflow — the thing a
// scheduler runs on Friday evening so plans are waiting when volunteers open
// the app. Idempotent: volunteers who already have a draft are skipped.
//
//   npm run prep-next-session            # next session that has not ended
//   npm run prep-next-session -- <id>    # a specific session
//
// Load env first: llmClient picks its provider when it is required.
require('dotenv').config();

const connectDB = require('../config/db');
const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');
const User = require('../models/User');
const { prepareSession } = require('../services/sessionPrepService');
const { CHAT_PROVIDER, CHAT_MODEL, isConfigured, notConfiguredMessage } = require('../services/llmClient');

async function main() {
  if (!isConfigured()) {
    console.error(notConfiguredMessage());
    process.exit(1);
  }
  await connectDB();

  const requestedId = process.argv[2];
  const session = requestedId
    ? await AttendanceSession.findById(requestedId).lean()
    : await AttendanceSession.findOne({ endTime: { $gt: new Date() } }).sort({ startTime: 1 }).lean();

  if (!session) {
    console.log('No upcoming session to prepare for.');
    process.exit(0);
  }

  const registrations = await Registration.find({ sessionId: session._id }).select('userId').lean();
  const volunteers = await User.find({ _id: { $in: registrations.map((r) => r.userId) } })
    .select('name email role')
    .lean();

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
