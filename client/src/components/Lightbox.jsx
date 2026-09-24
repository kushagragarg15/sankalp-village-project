import { useEffect, useRef } from 'react';

function Chevron({ dir }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/**
 * Full-size photo viewer. Arrow keys / swipe move through `photos`, Escape or
 * the scrim closes. Focus moves to the close button on open and goes back to
 * whatever opened it on close.
 */
export default function Lightbox({ photos, index, onChange, onClose }) {
  const closeRef = useRef(null);
  const touchX = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const open = index !== null;
  const photo = open ? photos[index] : null;
  const go = (delta) => onChange((index + delta + photos.length) % photos.length);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      opener?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'ArrowRight') onChange((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, photos.length, onChange]);

  if (!open) return null;

  const navButton =
    'absolute top-1/2 -translate-y-1/2 z-10 hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-full text-paper/80 hover:text-paper hover:bg-white/10 transition-colors';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption}
      className="fixed inset-0 z-[80] flex flex-col bg-board/95 animate-lift-in"
      onClick={onClose}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4 text-[13px] text-board-400">
        <span className="font-mono tabular-nums">
          {String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-paper/80 hover:text-paper hover:bg-white/10 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
        <button type="button" aria-label="Previous photo" className={`${navButton} left-4`} onClick={(e) => { e.stopPropagation(); go(-1); }}>
          <Chevron dir="left" />
        </button>

        <figure className="flex max-h-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
          <img
            key={photo.id}
            src={photo.src}
            alt={photo.alt}
            className="max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-md object-contain animate-lift-in"
          />
          <figcaption className="mt-3 text-center text-[14px] text-paper">{photo.caption}</figcaption>
        </figure>

        <button type="button" aria-label="Next photo" className={`${navButton} right-4`} onClick={(e) => { e.stopPropagation(); go(1); }}>
          <Chevron dir="right" />
        </button>
      </div>
      <div className="h-6 shrink-0" />
    </div>
  );
}
