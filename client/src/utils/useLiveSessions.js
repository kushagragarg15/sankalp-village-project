import { useCallback, useEffect, useRef, useState } from 'react';
import { attendanceSessionAPI } from './api';
import { isLive } from './session';

/**
 * The server mints and rotates codes as a side effect of listing sessions, so
 * polling this list is also what keeps a running session's code fresh.
 */
export default function useLiveSessions(intervalMs = 30000) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await attendanceSessionAPI.getAll();
      if (!mounted.current) return;
      setSessions(response.data.data || []);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err.response?.data?.message || 'Sessions could not be loaded right now.'
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh, intervalMs]);

  return {
    sessions,
    live: sessions.filter(isLive),
    loading,
    error,
    refresh,
  };
}
