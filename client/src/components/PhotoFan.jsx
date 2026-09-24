import { useEffect, useState } from 'react';

// A fan of photo prints pinned to the board. After React Bits' Bounce Cards
// (reactbits.dev): the prints land stacked, spring apart into an arc, and one
// at a time comes forward. Plain CSS transforms instead of GSAP — four
// elements do not need a timeline. White print margins and a hairline edge,
// no drop shadow (see the design rules: hierarchy comes from rules and tone).
const ROTATIONS = [-7, -2.5, 3, 8];
const LIFT = [10, 0, 4, 14];
const CYCLE_MS = 4200;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function PhotoFan({ photos, className = '' }) {
  const reduced = usePrefersReducedMotion();
  const [spread, setSpread] = useState(reduced);
  const [active, setActive] = useState(1);
  const [paused, setPaused] = useState(false);
  const count = photos.length;

  useEffect(() => {
    if (reduced) return undefined;
    const t = setTimeout(() => setSpread(true), 180);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (reduced || paused) return undefined;
    const t = setInterval(() => setActive((i) => (i + 1) % count), CYCLE_MS);
    return () => clearInterval(t);
  }, [reduced, paused, count]);

  // Prints are 4:5 and each overlaps the last by 45%; the container's aspect
  // ratio follows, so the fan scales from its height alone.
  const cardShare = 1 / (1 + 0.55 * (count - 1));
  const step = count > 1 ? (1 - cardShare) / (count - 1) : 0;
  const mid = (count - 1) / 2;

  return (
    <div
      className={`relative ${className}`}
      style={{ aspectRatio: `${0.8 / cardShare}` }}
      onMouseLeave={() => setPaused(false)}
    >
      {photos.map((p, i) => {
        const isActive = spread && i === active;
        const left = spread ? i * step : mid * step;
        const rotate = !spread ? 0 : isActive ? 0 : ROTATIONS[i % ROTATIONS.length];
        const y = !spread ? 0 : isActive ? -10 : LIFT[i % LIFT.length];
        const scale = isActive ? 1.06 : 1;
        const z = isActive ? count + 1 : count - Math.abs(i - active);

        return (
          <div
            key={p.id}
            onMouseEnter={() => {
              setPaused(true);
              setActive(i);
            }}
            className="absolute top-0 h-full rounded-[3px] bg-paper p-[5px] ring-1 ring-black/10"
            style={{
              left: `${left * 100}%`,
              width: `${cardShare * 100}%`,
              zIndex: z,
              transform: `translateY(${y}px) rotate(${rotate}deg) scale(${scale})`,
              transition: reduced
                ? 'none'
                : 'left 900ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 700ms cubic-bezier(0.34, 1.4, 0.64, 1)',
              transitionDelay: spread ? '0ms' : `${i * 60}ms`,
            }}
          >
            <img
              src={p.small}
              alt=""
              draggable="false"
              className="h-full w-full rounded-[2px] object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}
