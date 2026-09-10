import { useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import LiveCode from '../components/LiveCode';
import EmptyState from '../components/EmptyState';
import Spine, { SpineEntry } from '../components/Spine';
import Badge from '../components/Badge';
import { attendanceSessionAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import useLiveSessions from '../utils/useLiveSessions';
import { formatDay, formatTime, relativeToNow, sessionState } from '../utils/session';

// A session is named for the day it runs, so it reads the same in the app
// and in the club's own notes: 11.09.26.Friday
const titleForDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const dayName = date.toLocaleDateString('en-IN', { weekday: 'long' });
  return `${day}.${month}.${year}.${dayName}`;
};

const SESSION_HOURS = 3;

export default function AdminSessions() {
  const { sessions, loading, error, refresh } = useLiveSessions();
  const toast = useToast();
  const [openDialog, setOpenDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + SESSION_HOURS * 3600 * 1000);
      await attendanceSessionAPI.create({
        title: titleForDate(startTime),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      setOpenDialog(false);
      await refresh();
      toast.done('Session opened. The code is live now.');
    } catch (err) {
      toast.blocked(err.response?.data?.message || 'The session could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await attendanceSessionAPI.delete(pendingDelete._id);
      setPendingDelete(null);
      await refresh();
      toast.done('Session deleted.');
    } catch (err) {
      toast.blocked(err.response?.data?.message || 'The session could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const running = sessions.filter((s) => sessionState(s) === 'live');
  const scheduled = sessions
    .filter((s) => sessionState(s) === 'upcoming')
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const closed = sessions.filter((s) => sessionState(s) === 'ended');

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
        lede="Opening a session starts a three-hour window and issues a code that rotates every ten minutes. Volunteers can only record attendance while it is running."
        actions={
          <Button onClick={() => setOpenDialog(true)}>Open a session</Button>
        }
      />

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-brick-line bg-brick-wash px-4 py-3">
          <p className="text-sm text-brick">{error}</p>
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="Open one when volunteers are heading out to the village. It runs for three hours."
          action={<Button onClick={() => setOpenDialog(true)}>Open a session</Button>}
        />
      ) : (
        <div className="space-y-10">
          {running.length > 0 && (
            <section>
              <h2 className="type-title mb-4 text-[15px] text-ink">Running now</h2>
              <div className="space-y-5">
                {running.map((session) => (
                  <div key={session._id}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium text-ink">{session.title}</h3>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(session)}
                        className="text-[13px] text-brick underline underline-offset-4 hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                    <LiveCode session={session} onExpire={refresh} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {scheduled.length > 0 && (
            <section>
              <h2 className="type-title mb-4 text-[15px] text-ink">Scheduled</h2>
              <Spine>
                {scheduled.map((session) => (
                  <SpineEntry key={session._id} state="upcoming">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div>
                        <p className="text-sm font-medium text-ink">{session.title}</p>
                        <p className="text-[13px] text-ink-2">
                          {formatDay(session.startTime)}, {formatTime(session.startTime)} to{' '}
                          {formatTime(session.endTime)}
                          <span className="text-ink-3"> · {relativeToNow(session.startTime)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(session)}
                        className="text-[13px] text-brick underline underline-offset-4 hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                  </SpineEntry>
                ))}
              </Spine>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h2 className="type-title mb-4 text-[15px] text-ink">Closed</h2>
              <Spine>
                {closed.map((session) => (
                  <SpineEntry key={session._id} state="done">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div>
                        <p className="text-sm text-ink">{session.title}</p>
                        <p className="text-[13px] text-ink-2">
                          {formatDay(session.startTime)}, {formatTime(session.startTime)} to{' '}
                          {formatTime(session.endTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="quiet">Closed</Badge>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(session)}
                          className="text-[13px] text-brick underline underline-offset-4 hover:opacity-80"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </SpineEntry>
                ))}
              </Spine>
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={openDialog}
        onClose={() => setOpenDialog(false)}
        title="Open a session"
        description="It starts immediately and closes three hours from now."
        size="sm"
      >
        <form onSubmit={handleCreate}>
          <div className="rounded-lg border border-rule bg-paper px-4 py-4">
            <p className="text-[13px] text-ink-2">Session name</p>
            <p className="type-title mt-0.5 text-[17px] text-ink">
              {titleForDate(new Date())}
            </p>
            <p className="mt-3 text-[13px] text-ink-2">
              Closes at{' '}
              {formatTime(new Date(Date.now() + SESSION_HOURS * 3600 * 1000))}
            </p>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Opening' : 'Open session'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this session?"
        description={pendingDelete?.title}
        size="sm"
      >
        <p className="text-sm text-ink-2">
          Attendance already recorded against this session will no longer be
          reachable from the report. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingDelete(null)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={busy}>
            {busy ? 'Deleting' : 'Delete session'}
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
