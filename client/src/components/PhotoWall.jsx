import { useMemo } from 'react';
import { GALLERY } from '../data/villagePhotos';
import { LOGIN_PHOTOS } from '../data/loginPhotos';

/**
 * The login background: every session photo at once, in tilted columns that
 * drift up and down at their own pace and never run out — the sense of
 * afternoons like these happening everywhere at the same time.
 *
 * Pure CSS transforms on the GPU; each column holds its photos twice and
 * loops by moving half its height (`wall-up` / `wall-down` in the Tailwind
 * config). Decorative, so it is hidden from assistive tech, and it stands
 * still for anyone who prefers reduced motion (the global rule in index.css).
 */

const ALL = [
  ...LOGIN_PHOTOS.map((p) => ({ src: p.src, shape: 'landscape' })),
  ...GALLERY.map((p) => ({ src: p.small, shape: p.shape })),
];

const ASPECT = { landscape: 'aspect-[4/3]', portrait: 'aspect-[3/4]', square: 'aspect-square' };

// Small tiles, many columns: the point is how many there are. Columns beyond
// the first four only appear on wider screens.
const COLUMNS = 11;
const PER_COLUMN = 9;
const visibility = (i) => (i < 4 ? '' : i < 7 ? 'hidden md:flex' : 'hidden lg:flex');

export default function PhotoWall({ className = '' }) {
  const columns = useMemo(
    () =>
      Array.from({ length: COLUMNS }, (_, c) => {
        // Each column starts at a different point in the set, stepping by a
        // number coprime with its size, so neighbours never line up.
        const photos = Array.from({ length: PER_COLUMN }, (_, k) => ALL[(c * 5 + k * 3) % ALL.length]);
        return {
          photos,
          up: c % 2 === 0,
          // Slower toward the edges, a little faster in the middle.
          seconds: 70 + ((c * 37) % 5) * 11,
        };
      }),
    []
  );

  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 overflow-hidden bg-board ${className}`}>
      <div className="absolute left-1/2 top-1/2 flex h-[150vh] w-[150vw] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] gap-3">
        {columns.map((col, i) => (
          <div key={i} className={`min-w-0 flex-1 flex-col ${visibility(i) || 'flex'}`}>
            <div
              className={`flex flex-col gap-3 will-change-transform ${col.up ? 'animate-wall-up' : 'animate-wall-down'}`}
              style={{ animationDuration: `${col.seconds}s` }}
            >
              {[...col.photos, ...col.photos].map((p, k) => (
                <img
                  key={k}
                  src={p.src}
                  alt=""
                  draggable="false"
                  decoding="async"
                  className={`w-full rounded-lg object-cover ${ASPECT[p.shape]}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
