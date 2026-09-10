import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import useLiveSessions from '../utils/useLiveSessions';

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { live } = useLiveSessions(60000);

  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[70] focus:top-3 focus:left-3 focus:rounded-md focus:bg-board focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {/* Phone bar. Carries the live state so it is never more than a glance away. */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 h-14 flex items-center gap-3 border-b border-rule bg-surface px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md text-ink hover:bg-paper transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="type-title text-[15px] text-ink">Sankalp Club</span>
        {live.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded border border-gold-line bg-gold-wash px-2 py-0.5 text-xs font-medium text-gold-deep">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold animate-rule-pulse" />
            Live
          </span>
        )}
      </header>

      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-board/50"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[264px] md:w-60 md:translate-x-0 transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0 animate-drawer-in' : '-translate-x-full'
        }`}
      >
        <Sidebar onNavigate={closeDrawer} liveCount={live.length} />
      </div>

      <div className="md:pl-60">
        <main id="main" className="px-4 pb-16 pt-[4.5rem] sm:px-8 md:pt-10 md:pb-20">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
