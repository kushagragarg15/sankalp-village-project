import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingState from '../components/LoadingState';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import {
  attendanceSessionAPI,
  getStudents,
  registrationAPI,
  teachingLogAPI,
} from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatTime, sessionState } from '../utils/session';

/**
 * The field screen. A volunteer is standing in a classroom on a phone with a
 * code that expires, so this page is one column, thumb-sized, and ordered the
 * way the task actually happens: code, then who you taught, then submit.
 */
export default function AttendancePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [registered, setRegistered] = useState(false);
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState({});
  const [code, setCode] = useState('');
  const [location, setLocation] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [sessionRes, studentsRes, registrationsRes] = await Promise.all([
          attendanceSessionAPI.getOne(sessionId),
          getStudents(),
          registrationAPI.getMyRegistrations(),
        ]);
        if (cancelled) return;
        setSession(sessionRes.data.data);
        setStudents(studentsRes.data.data || []);
        setRegistered(
          (registrationsRes.data.data || []).some(
            (reg) => (reg.sessionId?._id || reg.sessionId) === sessionId
          )
        );
      } catch (err) {
        if (!cancelled) setError('This session could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationDenied(false);
      },
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(requestLocation, []);

  // Registering is one tap from here rather than a trip back to the list: the
  // volunteer is already standing in the classroom, and the only thing missing
  // is a row saying so.
  const handleRegister = async () => {
    setJoining(true);
    setError('');
    try {
      await registrationAPI.register(sessionId);
      setRegistered(true);
      toast.done('You are on the list. Record the lesson below.');
    } catch (err) {
      const message = err.response?.data?.message || '';
      // Already registered somewhere else (another tab, another device) is not
      // a failure — it is the state we were trying to reach.
      if (/already registered/i.test(message)) {
        setRegistered(true);
      } else {
        setError(message || 'You could not be added to this session. Try again.');
      }
    } finally {
      setJoining(false);
    }
  };

  const toggle = (studentId) => {
    setPicked((current) => {
      const next = { ...current };
      if (next[studentId]) {
        delete next[studentId];
      } else {
        next[studentId] = { student_id: studentId, subject: '', topic: '' };
      }
      return next;
    });
  };

  const update = (studentId, field, value) => {
    setPicked((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [field]: value },
    }));
  };

  const entries = Object.values(picked);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        String(s.grade).toLowerCase().includes(term)
    );
  }, [students, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (code.length < 4) {
      setError('Enter the four-digit code your coordinator read out.');
      return;
    }
    if (entries.length === 0) {
      setError('Pick at least one student you taught.');
      return;
    }
    const incomplete = entries.find((entry) => !entry.subject.trim() || !entry.topic.trim());
    if (incomplete) {
      setError('Every student you picked needs a subject and a topic.');
      return;
    }
    if (!location) {
      setError('Attendance is recorded on site, so location access is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await teachingLogAPI.submit({
        session_id: sessionId,
        entries,
        code,
        lat: location.lat,
        lng: location.lng,
      });
      toast.done(response.data.message || 'Attendance recorded.');
      navigate('/volunteer-sessions');
    } catch (err) {
      const message = err.response?.data?.message || '';
      // The registration can disappear under us — a coordinator removing someone
      // from the list mid-session. Send them back to the gate rather than
      // leaving a dead-end message under a form that will never submit.
      if (err.response?.status === 403 && /not registered/i.test(message)) {
        setRegistered(false);
        setError('');
        toast.blocked('You are no longer on the list for this session.');
        return;
      }
      setError(message || 'Attendance was not recorded. Check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Opening the session" />
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <EmptyState
          title="Session not found"
          description="It may have been deleted. Go back and pick a session from the list."
          action={
            <Button onClick={() => navigate('/volunteer-sessions')}>
              Back to sessions
            </Button>
          }
        />
      </Layout>
    );
  }

  const state = sessionState(session);

  if (state !== 'live') {
    return (
      <Layout>
        <EmptyState
          title={state === 'upcoming' ? 'This session has not started' : 'This session has closed'}
          description={
            state === 'upcoming'
              ? `It opens at ${formatTime(session.startTime)}. Attendance can only be recorded while it is running.`
              : `It closed at ${formatTime(session.endTime)}. Ask your coordinator to open a new session if a lesson still needs recording.`
          }
          action={
            <Button onClick={() => navigate('/volunteer-sessions')}>
              Back to sessions
            </Button>
          }
        />
      </Layout>
    );
  }

  const backLink = (
    <button
      type="button"
      onClick={() => navigate('/volunteer-sessions')}
      className="mb-4 text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink"
    >
      Back to sessions
    </button>
  );

  // Registration is checked here, before any work is asked for. The server
  // refuses an unregistered submission anyway, but it used to do so at the end:
  // a volunteer typed the code, ticked ten children, filled in twenty subject
  // and topic fields, pressed submit and only then learned they were not on the
  // list. The check belongs in front of the form, with the fix attached to it.
  if (!registered) {
    return (
      <Layout>
        {backLink}

        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold animate-rule-pulse" />
            <span className="text-[13px] font-medium text-gold-deep">Live now</span>
            <span className="text-[13px] text-ink-2">closes {formatTime(session.endTime)}</span>
          </div>
          <h1 className="type-display mt-2 text-[26px] sm:text-[32px] text-ink">
            {session.title}
          </h1>
        </div>

        <EmptyState
          title="Register for this session first"
          description="Attendance is recorded against the volunteers on the session list, and you are not on it yet. Add yourself and the form opens straight away."
          action={
            <Button variant="live" size="lg" onClick={handleRegister} loading={joining}>
              {joining ? 'Registering' : 'Register for this session'}
            </Button>
          }
        />

        {error && (
          <div role="alert" className="mt-4 rounded-md border border-brick-line bg-brick-wash px-4 py-3">
            <p className="text-sm text-brick">{error}</p>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      {backLink}

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold animate-rule-pulse" />
          <span className="text-[13px] font-medium text-gold-deep">Live now</span>
          <span className="text-[13px] text-ink-2">closes {formatTime(session.endTime)}</span>
        </div>
        <h1 className="type-display mt-2 text-[26px] sm:text-[32px] text-ink">
          Record attendance
        </h1>
        <p className="mt-1 text-sm text-ink-2">{session.title}</p>
      </div>

      <form onSubmit={handleSubmit} className="pb-28 md:pb-0">
        {/* The gate. */}
        <section className="mb-8">
          <label htmlFor="code" className="block type-title text-[15px] text-ink">
            Session code
          </label>
          <p className="mt-1 text-[13px] text-ink-2">
            Four digits, read out by your coordinator. It changes every ten minutes.
          </p>
          <input
            id="code"
            value={code}
            onChange={(e) => {
              // Digits only, so a stray letter or a pasted space cannot sit in
              // the field looking like a wrong code.
              setCode(e.target.value.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="one-time-code"
            autoCorrect="off"
            spellCheck="false"
            placeholder="————"
            aria-describedby="code-help"
            className="mt-3 w-full sm:w-[11ch] h-16 rounded-lg border border-rule-strong bg-surface px-4 text-center font-mono text-[28px] font-bold tabular-nums tracking-code text-ink placeholder:text-rule-strong outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold"
          />
          <p id="code-help" className="sr-only">
            Enter the four digit attendance code
          </p>
        </section>

        {/* Location: a quiet ruled line, not a coloured slab. */}
        <section className="mb-8 flex flex-wrap items-center justify-between gap-2 border-y border-rule py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${location ? 'bg-teal' : 'bg-brick'}`}
            />
            <span className="text-sm text-ink">
              {location ? 'You are on site' : 'Location needed'}
            </span>
            {location && (
              <span className="font-mono text-[12px] text-ink-3">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            )}
          </div>
          {!location && (
            <button
              type="button"
              onClick={requestLocation}
              className="text-[13px] text-ink underline underline-offset-4"
            >
              {locationDenied ? 'Try again' : 'Share location'}
            </button>
          )}
        </section>

        <section className="mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="type-title text-[15px] text-ink">Who did you teach?</h2>
            <span className="text-[13px] text-ink-2 tabular-nums">
              {entries.length} selected
            </span>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or class"
            aria-label="Search students"
            className="mt-3 w-full h-11 rounded-md border border-rule-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-board focus:ring-1 focus:ring-board"
          />

          {filtered.length === 0 ? (
            <p className="mt-6 text-sm text-ink-2">
              No student matches “{search}”. Check the spelling, or clear the search.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {filtered.map((student) => {
                const selected = !!picked[student._id];
                return (
                  <li key={student._id} className={selected ? 'bg-gold-wash' : ''}>
                    <label className="flex cursor-pointer items-center gap-3 px-1 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(student._id)}
                        className="h-5 w-5 shrink-0 accent-[#17211F] cursor-pointer"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-ink truncate">
                          {student.name}
                        </span>
                        <span className="block text-[13px] text-ink-2">{student.grade}</span>
                      </span>
                    </label>

                    {selected && (
                      <div className="grid grid-cols-1 gap-3 px-1 pb-4 sm:grid-cols-2 sm:pl-9">
                        <div>
                          <label
                            htmlFor={`subject-${student._id}`}
                            className="block text-[13px] text-ink-2 mb-1"
                          >
                            Subject
                          </label>
                          <input
                            id={`subject-${student._id}`}
                            value={picked[student._id].subject}
                            onChange={(e) => update(student._id, 'subject', e.target.value)}
                            placeholder="Maths"
                            className="w-full h-11 rounded-md border border-rule-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-board focus:ring-1 focus:ring-board"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`topic-${student._id}`}
                            className="block text-[13px] text-ink-2 mb-1"
                          >
                            Topic
                          </label>
                          <input
                            id={`topic-${student._id}`}
                            value={picked[student._id].topic}
                            onChange={(e) => update(student._id, 'topic', e.target.value)}
                            placeholder="Fractions"
                            className="w-full h-11 rounded-md border border-rule-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none focus:border-board focus:ring-1 focus:ring-board"
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-brick-line bg-brick-wash px-4 py-3 md:mb-6"
          >
            <p className="text-sm text-brick">{error}</p>
          </div>
        )}

        {/* Thumb-reachable on a phone, inline on a laptop. */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-rule bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <span className="flex-1 text-[13px] text-ink-2 tabular-nums md:hidden">
            {entries.length} {entries.length === 1 ? 'student' : 'students'}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/volunteer-sessions')}
            className="hidden md:inline-flex"
          >
            Cancel
          </Button>
          <Button type="submit" variant="live" size="lg" loading={submitting}>
            {submitting ? 'Recording' : 'Record attendance'}
          </Button>
        </div>
      </form>
    </Layout>
  );
}
