import { useEffect, useRef, useState } from 'react';

/**
 * One line that says what the assistant is doing while it works — the latest
 * step, breathing gently, with a running timer — and settles into
 * "Thought for 4s" when the answer starts. Collapsible: the full list of
 * steps opens underneath.
 *
 * `working` may flip back to true after settling (the agent streamed some
 * narration, then retracted it and called a tool); the line simply resumes
 * and the timer keeps counting from the first start. Pass `seconds` with
 * `working={false}` to render an already-settled line (e.g. a past answer).
 *
 * Props follow the usual ThoughtLine API: working, steps, label, doneLabel,
 * glyph ('sparkle' | 'dot'), fontSize, breathPeriod (s), breathDepth (0–1),
 * settleDuration (ms), settleBlur (px), collapsible, collapseOnSettle,
 * showTimer, onSettle(seconds).
 */

function Sparkle({ spinning }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 text-gold ${spinning ? 'animate-thought-spin' : ''}`}
    >
      <path fill="currentColor" d="M12 2c.4 4.9 2.9 7.6 8 8-5.1.4-7.6 3.1-8 8-.4-4.9-2.9-7.6-8-8 5.1-.4 7.6-3.1 8-8z" transform="translate(0 2)" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="0.85em" height="0.85em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-teal">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export default function ThoughtLine({
  working,
  steps = [],
  label = 'Thinking…',
  doneLabel = 'Thought for',
  glyph = 'sparkle',
  fontSize = 16,
  breathPeriod = 1.6,
  breathDepth = 0.45,
  settleDuration = 350,
  settleBlur = 2,
  collapsible = false,
  collapseOnSettle = false,
  showTimer = false,
  onSettle,
  seconds: givenSeconds,
  className = '',
}) {
  const startRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [settledSeconds, setSettledSeconds] = useState(working ? null : givenSeconds ?? null);
  const [open, setOpen] = useState(false);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  useEffect(() => {
    if (working) {
      if (startRef.current === null) startRef.current = performance.now();
      setSettledSeconds(null);
      const tick = () => setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }
    if (startRef.current !== null) {
      const secs = Math.max(1, Math.round((performance.now() - startRef.current) / 1000));
      setSettledSeconds(secs);
      if (collapseOnSettle) setOpen(false);
      onSettleRef.current?.(secs);
    }
    return undefined;
  }, [working, collapseOnSettle]);

  const settled = !working && settledSeconds !== null;
  if (!working && !settled) return null;

  const current = working ? steps[steps.length - 1] || label : `${doneLabel} ${settledSeconds}s`;
  const canOpen = collapsible && steps.length > 0;

  const line = (
    <>
      {glyph === 'sparkle' ? (
        <Sparkle spinning={working} />
      ) : (
        <span aria-hidden="true" className={`h-[0.45em] w-[0.45em] shrink-0 rounded-full bg-gold ${working ? 'animate-rule-pulse' : ''}`} />
      )}
      {/* Re-keyed on every change so each new line comes into focus. */}
      <span
        key={current}
        className="min-w-0 truncate animate-thought-in"
        style={{ animationDuration: `${settleDuration}ms`, '--settle-blur': `${settleBlur}px` }}
      >
        <span
          className={working ? 'animate-thought-breathe' : ''}
          style={working ? { animationDuration: `${breathPeriod}s`, '--breath-min': String(1 - breathDepth) } : undefined}
        >
          {current}
        </span>
      </span>
      {working && showTimer && <span className="shrink-0 tabular-nums text-ink-3">{elapsed}s</span>}
      {canOpen && (
        <svg width="0.7em" height="0.7em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </>
  );

  return (
    <div className={className} style={{ fontSize }}>
      {canOpen ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex max-w-full items-center gap-2 text-left text-ink-2 hover:text-ink"
        >
          {line}
        </button>
      ) : (
        <div className="flex max-w-full items-center gap-2 text-ink-2" aria-live="polite">
          {line}
        </div>
      )}

      {canOpen && open && (
        <ol className="mt-2 space-y-1.5 border-l border-rule pl-3 text-[0.85em] text-ink-2">
          {steps.map((step, i) => {
            const active = working && i === steps.length - 1;
            return (
              <li key={`${i}-${step}`} className="flex items-center gap-2">
                {active ? (
                  <span aria-hidden="true" className="h-[0.4em] w-[0.4em] shrink-0 rounded-full bg-gold animate-rule-pulse" />
                ) : (
                  <Check />
                )}
                <span className={active ? 'text-ink' : ''}>{step}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
