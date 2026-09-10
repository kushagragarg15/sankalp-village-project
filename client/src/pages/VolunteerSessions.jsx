import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import Badge from '../components/Badge';
import SessionRow from '../components/SessionRow';
import { registrationAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import useLiveSessions from '../utils/useLiveSessions';
import { sessionState } from '../utils/session';

export default function VolunteerSessions() {
  const navigate = useNavigate();
  const toast = useToast();
  const { sessions, loading, error, refresh } = useLiveSessions();
  const [registrations, setRegistrations] = useState([]);
  const [registering, setRegistering] = useState(null);

  const loadRegistrations = async () => {
    try {
      const response = await registrationAPI.getMyRegistrations();
      setRegistrations(response.data.data || []);
    } catch {
      setRegistrations([]);
    }
  };

  useEffect(() => {
    loadRegistrations();
  }, []);

  const isRegistered = (sessionId) =>
    registrations.some((reg) => reg.sessionId?._id === sessionId);

  const handleRegister = async (session) => {
    setRegistering(session._id);
    try {
      await registrationAPI.register(session._id);
      await loadRegistrations();
      toast.done(`Registered for ${session.title}.`);
    } catch (err) {
      toast.blocked(
        err.response?.data?.message || 'You could not be registered for that session.'
      );
    } finally {
      setRegistering(null);
    }
  };

  const ordered = [...sessions].sort((a, b) => {
    const rank = { live: 0, upcoming: 1, ended: 2 };
    const diff = rank[sessionState(a)] - rank[sessionState(b)];
    if (diff !== 0) return diff;
    return new Date(a.startTime) - new Date(b.startTime);
  });

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading sessions" />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Sessions"
        lede="Register for a session before it starts. Once it is running, record each student you taught while you are still at the school."
      />

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-brick-line bg-brick-wash px-4 py-3">
          <p className="text-sm text-brick">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-1.5 text-[13px] text-brick underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Your coordinator opens a session before each village visit. Check back closer to the day."
        />
      ) : (
        <div className="space-y-3">
          {ordered.map((session) => {
            const state = sessionState(session);
            const registered = isRegistered(session._id);

            return (
              <SessionRow
                key={session._id}
                session={session}
                badges={registered ? [<Badge key="r" variant="recorded">Registered</Badge>] : []}
                actions={
                  state === 'ended' ? (
                    <span className="text-[13px] text-ink-3 self-center">Closed</span>
                  ) : !registered ? (
                    <Button
                      variant={state === 'live' ? 'live' : 'secondary'}
                      onClick={() => handleRegister(session)}
                      disabled={registering === session._id}
                    >
                      {registering === session._id ? 'Registering' : 'Register'}
                    </Button>
                  ) : state === 'live' ? (
                    <Button
                      variant="live"
                      onClick={() => navigate(`/attendance/${session._id}`)}
                    >
                      Record attendance
                    </Button>
                  ) : (
                    <span className="text-[13px] text-ink-2 self-center">
                      You are on the list
                    </span>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </Layout>
  );
}
