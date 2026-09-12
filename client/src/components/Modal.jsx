import { useEffect, useRef } from 'react';

const sizes = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const closeRef = useRef(onClose);

  // Every caller passes an inline arrow for onClose, so its identity changes on
  // each render of the page holding the modal — and that page re-renders on
  // every keystroke of the form inside. With onClose in the dependency list the
  // effect below tore down and re-ran per character: the cleanup restored focus
  // to the trigger button and the re-run put it back on the first field, so a
  // second character never reached the field being typed into. The handler is
  // read from a ref instead, and the effect runs once per open.
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    restoreRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    // Land on the first field so a keyboard user starts where the work is.
    const items = focusable();
    (items.find((el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || items[0])?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      restoreRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-board/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex min-h-full items-end sm:items-center justify-center p-0 sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={`relative w-full ${sizes[size]} bg-surface rounded-t-xl sm:rounded-xl border border-rule shadow-[0_16px_48px_-12px_rgba(23,33,31,0.28)] max-h-[92vh] overflow-y-auto animate-lift-in`}
        >
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-rule sticky top-0 bg-surface z-10">
            <div>
              <h2 id="modal-title" className="type-title text-[17px] text-ink">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-[13px] text-ink-2">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1 shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-paper transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
