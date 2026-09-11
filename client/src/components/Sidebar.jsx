import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/sankalp-logo.jpg';

// Named for what a volunteer or coordinator would call them, not for the
// tables underneath.
const adminLinks = [
  { path: '/dashboard', label: 'Today' },
  { path: '/admin-sessions', label: 'Sessions' },
  { path: '/attendance-report', label: 'Attendance' },
  { path: '/volunteers', label: 'Volunteers' },
  { path: '/students', label: 'Students' },
  { path: '/analytics', label: 'Insights' },
  { path: '/ai-notes', label: 'Lesson planner' },
  { path: '/ask', label: 'Ask' },
  { path: '/ai-activity', label: 'AI activity' },
];

const volunteerLinks = [
  { path: '/dashboard', label: 'Today' },
  { path: '/volunteer-sessions', label: 'Sessions' },
  { path: '/my-attendance-new', label: 'My record' },
  { path: '/students', label: 'Students' },
  { path: '/analytics', label: 'Insights' },
  { path: '/ai-notes', label: 'Lesson planner' },
  { path: '/ask', label: 'Ask' },
];

export default function Sidebar({ onNavigate, liveCount = 0 }) {
  const { user, isAdmin, logout } = useAuth();
  const links = isAdmin ? adminLinks : volunteerLinks;

  return (
    <div className="flex h-full w-full flex-col bg-board text-paper">
      <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-board-600">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={logoImage}
            alt=""
            className="h-8 w-8 rounded object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="type-title text-[15px] text-paper truncate">Sankalp Club</p>
            <p className="text-[12px] text-board-400 truncate">Teaching register</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onNavigate}
          aria-label="Close menu"
          className="md:hidden -mr-2 h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-md text-board-400 hover:text-paper hover:bg-board-600 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <ul className="space-y-0.5">
          {links.map((link) => (
            <li key={link.path}>
              <NavLink
                to={link.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 rounded-md px-3 h-10 text-sm transition-colors ${
                    isActive
                      ? 'bg-board-600 text-paper font-medium'
                      : 'text-board-400 hover:text-paper hover:bg-board-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        aria-hidden="true"
                        className={`h-4 w-px shrink-0 ${
                          isActive ? 'bg-gold-bright' : 'bg-transparent'
                        }`}
                      />
                      <span className="truncate">{link.label}</span>
                    </span>
                    {link.path === '/dashboard' && liveCount > 0 && (
                      <span className="shrink-0 rounded bg-gold-bright px-1.5 text-[11px] font-semibold text-board tabular-nums">
                        {liveCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-board-600 px-5 py-4">
        <p className="text-sm font-medium text-paper truncate">{user?.name}</p>
        <p className="text-[12px] text-board-400 truncate">
          {isAdmin ? 'Coordinator' : 'Volunteer'}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 text-[13px] text-board-400 hover:text-paper underline underline-offset-4 decoration-board-500 hover:decoration-paper transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
