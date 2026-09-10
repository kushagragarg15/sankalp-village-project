import Badge from './Badge';
import { formatDay, formatTime, relativeToNow, sessionState } from '../utils/session';

/**
 * One session as it appears in a list: the time on the left where the eye
 * scans for it, the title next, actions on the right.
 */
export default function SessionRow({ session, badges = [], actions, children }) {
  const state = sessionState(session);

  return (
    <div
      className={`rounded-lg border px-4 py-3.5 sm:px-5 sm:py-4 ${
        state === 'live'
          ? 'border-gold-line bg-gold-wash'
          : 'border-rule bg-surface'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-title text-[15px] text-ink">{session.title}</h3>
            {state === 'live' && <Badge variant="live">Live now</Badge>}
            {badges}
          </div>

          <p className="mt-1 text-[13px] text-ink-2">
            {formatDay(session.startTime)}, {formatTime(session.startTime)} to{' '}
            {formatTime(session.endTime)}
            {state === 'upcoming' && (
              <span className="text-ink-3"> · {relativeToNow(session.startTime)}</span>
            )}
            {state === 'ended' && <span className="text-ink-3"> · closed</span>}
          </p>
        </div>

        {actions && (
          <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
