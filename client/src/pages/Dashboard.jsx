import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import LiveCode from '../components/LiveCode';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Spine, { SpineEntry } from '../components/Spine';
import { useSessions } from '../context/SessionsContext';
import {
  formatDay,
  formatDayLong,
  formatTime,
  relativeToNow,
  sessionState,
} from '../utils/session';

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const { sessions, live, loading, error, refresh } = useSessions();

  const upcoming = sessions
    .filter((s) => sessionState(s) === 'upcoming')
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 4);

  const recent = sessions
    .filter((s) => sessionState(s) === 'ended')
    .slice(0, 3);

  const firstName = user?.name?.split(' ')[0];

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Reading the register" />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={live.length > 0 ? 'A session is running' : 'Today'}
        lede={
          live.length > 0
            ? isAdmin
              ? 'Read the code below out to the room. It changes every ten minutes.'
              : 'Head to the session to record who you taught before it closes.'
            : `Nothing is running right now, ${firstName}. Here is what is coming up.`
        }
      >
        <p className="text-[13px] text-ink-2 mb-2">{formatDayLong(new Date())}</p>
      </PageHeader>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-brick-line bg-brick-wash px-4 py-3"
        >
          <p className="text-sm text-brick">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-1.5 text-[13px] text-brick underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {live.length > 0 && (
        <section className="mb-10 space-y-4">
          {live.map((session) =>
            isAdmin ? (
              <div key={session._id}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="type-title text-[15px] text-ink">{session.title}</h2>
                  <Link
                    to="/admin-sessions"
                    className="text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
                  >
                    Manage session
                  </Link>
                </div>
                <LiveCode session={session} onExpire={refresh} />
              </div>
            ) : (
              <div
                key={session._id}
                className="rounded-lg bg-board px-5 py-5 sm:px-6 sm:py-6 text-paper"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-gold-bright animate-rule-pulse"
                  />
                  <span className="text-[13px] font-medium text-gold-bright">Live now</span>
                  <span className="text-[13px] text-board-400">
                    closes {formatTime(session.endTime)}
                  </span>
                </div>
                <h2 className="type-display mt-2.5 text-[24px] sm:text-[28px] text-paper">
                  {session.title}
                </h2>
                <p className="mt-2 max-w-[46ch] text-sm text-board-400">
                  Ask your coordinator for the five-character code, then record each
                  student you taught. You need to be at the school to submit.
                </p>
                <div className="mt-5">
                  <Button
                    variant="onBoard"
                    size="lg"
                    onClick={() => navigate(`/attendance/${session._id}`)}
                  >
                    Record attendance
                  </Button>
                </div>
              </div>
            )
          )}
        </section>
      )}

      <section className="mb-10">
        <h2 className="type-title mb-4 text-[15px] text-ink">Coming up</h2>

        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rule-strong bg-surface px-5 py-8">
            <p className="text-sm text-ink-2">
              {isAdmin
                ? 'No sessions are scheduled. Open one when volunteers are heading out.'
                : 'No sessions are scheduled yet. Your coordinator will open one before the next visit.'}
            </p>
            {isAdmin && (
              <div className="mt-4">
                <Link to="/admin-sessions">
                  <Button size="sm">Open a session</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <Spine>
            {upcoming.map((session) => (
              <SpineEntry key={session._id} state="upcoming">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{session.title}</p>
                    <p className="text-[13px] text-ink-2">
                      {formatDay(session.startTime)}, {formatTime(session.startTime)} to{' '}
                      {formatTime(session.endTime)}
                    </p>
                  </div>
                  <span className="text-[13px] text-ink-3 shrink-0">
                    {relativeToNow(session.startTime)}
                  </span>
                </div>
              </SpineEntry>
            ))}
          </Spine>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="type-title mb-4 text-[15px] text-ink">Recently closed</h2>
          <Spine>
            {recent.map((session) => (
              <SpineEntry key={session._id} state="done">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-sm text-ink-2">{session.title}</p>
                  <Badge variant="quiet">Closed</Badge>
                </div>
              </SpineEntry>
            ))}
          </Spine>
        </section>
      )}

      <section>
        <h2 className="type-title mb-3 text-[15px] text-ink">Elsewhere</h2>
        <ul className="divide-y divide-rule border-y border-rule">
          {(isAdmin
            ? [
                ['/attendance-report', 'Attendance', 'Every log from a session, with a CSV to download'],
                ['/volunteers', 'Volunteers', 'Who is turning up, ranked by sessions taught'],
                ['/students', 'Students', 'The enrolled roster and each child’s progress'],
              ]
            : [
                ['/my-attendance-new', 'My record', 'Sessions you have taught and where you rank'],
                ['/students', 'Students', 'The enrolled roster and each child’s progress'],
                ['/ai-notes', 'Lesson planner', 'Draft an outline before you head out'],
              ]
          ).map(([to, label, note]) => (
            <li key={to}>
              <Link
                to={to}
                className="flex items-baseline justify-between gap-4 py-3.5 group"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink group-hover:underline underline-offset-4">
                    {label}
                  </span>
                  <span className="block text-[13px] text-ink-2">{note}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
