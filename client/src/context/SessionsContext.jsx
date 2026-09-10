import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { attendanceSessionAPI } from '../utils/api';
import { isLive } from '../utils/session';
import { useAuth } from './AuthContext';

/**
 * One poll of /attendance-sessions for the whole app.
 *
 * Both the shell (for the live indicator) and the page inside it need this
 * list, and each used to run its own interval — so every session screen made
 * two identical requests, and each of those makes the server rotate codes.
 * Everything now shares this single subscription.
 */
const SessionsContext = createContext(null);

const POLL_MS = 30000;

export function SessionsProvider({ children }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const inFlight = useRef(null);

  const refresh = useCallback(async () => {
    // Collapse overlapping callers onto the request already running.
    if (inFlight.current) return inFlight.current;

    const request = (async () => {
      try {
        const response = await attendanceSessionAPI.getAll();
        if (!mounted.current) return;
        setSessions(response.data.data || []);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError(
          err.response?.data?.message ||
            'Sessions could not be loaded right now.'
        );
      } finally {
        if (mounted.current) setLoading(false);
        inFlight.current = null;
      }
    })();

    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    // The endpoint is authenticated, so there is nothing to ask for until
    // somebody is signed in.
    if (!user) {
      setLoading(false);
      setSessions([]);
      return undefined;
    }

    mounted.current = true;
    setLoading(true);
    refresh();

    const id = setInterval(() => {
      // A backgrounded tab does not need a fresh code.
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);

    // Catch up immediately when the volunteer comes back to the tab.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, user]);

  const value = useMemo(
    () => ({
      sessions,
      live: sessions.filter(isLive),
      loading,
      error,
      refresh,
    }),
    [sessions, loading, error, refresh]
  );

  return (
    <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionsContext);
  if (!context) throw new Error('useSessions must be used within SessionsProvider');
  return context;
}
