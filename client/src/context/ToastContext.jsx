import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = 'done') => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'blocked' ? 7000 : 4500);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      // Past tense: the button that says "Register" produces "Registered".
      done: (message) => push(message, 'done'),
      blocked: (message) => push(message, 'blocked'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed z-[60] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[min(24rem,calc(100vw-3rem))] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 animate-lift-in shadow-[0_8px_24px_-8px_rgba(23,33,31,0.3)] ${
              toast.tone === 'blocked'
                ? 'bg-surface border-brick-line'
                : 'bg-board border-board text-paper'
            }`}
          >
            <p
              className={`flex-1 text-sm ${
                toast.tone === 'blocked' ? 'text-brick' : 'text-paper'
              }`}
            >
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className={`-mr-1 -mt-0.5 shrink-0 h-6 w-6 inline-flex items-center justify-center rounded ${
                toast.tone === 'blocked'
                  ? 'text-ink-2 hover:text-ink'
                  : 'text-board-400 hover:text-paper'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
