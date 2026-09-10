import { useEffect, useState } from 'react';
import {
  CODE_WINDOW_SECONDS,
  clock,
  formatTime,
  secondsUntil,
  sessionState,
} from '../utils/session';

/**
 * The one loud thing in the product. A coordinator reads this code out to a
 * room, so the characters are spaced to be spoken and sized to be seen from
 * the back. The countdown is a rule that depletes — the same ruled language
 * the rest of the register uses, rather than a spinner.
 */
export default function LiveCode({ session, onExpire }) {
  const [left, setLeft] = useState(() => secondsUntil(session?.codeExpiry));
  const state = sessionState(session);

  useEffect(() => {
    if (state !== 'live') return;
    setLeft(secondsUntil(session?.codeExpiry));

    const id = setInterval(() => {
      const next = secondsUntil(session?.codeExpiry);
      setLeft(next);
      if (next === 0) onExpire?.();
    }, 1000);

    return () => clearInterval(id);
  }, [session?.codeExpiry, state, onExpire]);

  if (state === 'upcoming') {
    return (
      <div className="rounded-lg border border-dashed border-rule-strong bg-paper px-4 py-3.5">
        <p className="text-[13px] text-ink-2">
          A code appears here when the session opens at{' '}
          <span className="text-ink font-medium">
            {formatTime(session.startTime)}
          </span>
          .
        </p>
      </div>
    );
  }

  if (state === 'ended') {
    return (
      <div className="rounded-lg border border-rule bg-paper px-4 py-3.5">
        <p className="text-[13px] text-ink-2">
          This session closed at {formatTime(session.endTime)}. Codes are no
          longer issued.
        </p>
      </div>
    );
  }

  if (!session.activeCode || left === 0) {
    return (
      <div className="rounded-lg border border-gold-line bg-gold-wash px-4 py-3.5">
        <p className="text-[13px] text-gold-deep">
          Issuing a fresh code. It will appear within a few seconds.
        </p>
      </div>
    );
  }

  const remaining = Math.min(1, left / CODE_WINDOW_SECONDS);
  const urgent = left <= 60;

  return (
    <div className="rounded-lg bg-board text-paper overflow-hidden">
      <div className="px-5 pt-4 pb-5 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-gold-bright animate-rule-pulse"
          />
          <span className="text-[13px] font-medium text-gold-bright">
            Live now
          </span>
          <span className="text-[13px] text-board-400">
            closes {formatTime(session.endTime)}
          </span>
        </div>

        <p
          className="mt-3 font-mono font-bold text-gold-bright tabular-nums text-[clamp(2.6rem,11vw,4.5rem)] leading-none tracking-code"
          aria-label={`Attendance code ${String(session.activeCode)
            .split('')
            .join(' ')}`}
        >
          {session.activeCode}
        </p>

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-board-400">
            Volunteers enter this to record attendance
          </span>
          <span
            className={`font-mono text-sm tabular-nums ${
              urgent ? 'text-white' : 'text-board-400'
            }`}
          >
            {clock(left)}
          </span>
        </div>
      </div>

      {/* The depleting rule. */}
      <div
        className="h-1 bg-board-600"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={CODE_WINDOW_SECONDS}
        aria-valuenow={left}
        aria-label="Time until this code is replaced"
      >
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            urgent ? 'bg-white animate-rule-pulse' : 'bg-gold-bright'
          }`}
          style={{ width: `${remaining * 100}%` }}
        />
      </div>
    </div>
  );
}
