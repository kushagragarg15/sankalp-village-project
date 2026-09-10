import { useEffect, useState } from 'react';
import { volunteerAttendanceAPI } from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import StatStrip from '../components/StatStrip';
import Spine, { SpineEntry } from '../components/Spine';
import { useToast } from '../context/ToastContext';
import { formatDay, formatTime } from '../utils/session';

export default function MyAttendanceNew() {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const response = await volunteerAttendanceAPI.getMyAttendance();
        setAttendance(response.data.data);
      } catch {
        toast.blocked('Your record could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Loading your record" />
      </Layout>
    );
  }

  const history = attendance?.attendanceHistory || [];
  const studentsTaught = new Set(
    history.flatMap((record) => record.students.map((s) => s.name))
  ).size;

  return (
    <Layout>
      <PageHeader
        title="My record"
        lede="Every session you have taught, and what you covered with each child."
      />

      <StatStrip
        className="mb-8 lg:grid-cols-3"
        items={[
          {
            label: 'Sessions taught',
            value: attendance?.totalSessions ?? 0,
          },
          {
            label: 'Rank',
            value: attendance?.rank ? `${attendance.rank}` : '—',
            note: attendance?.totalVolunteers
              ? `of ${attendance.totalVolunteers} volunteers`
              : undefined,
          },
          {
            label: 'Children taught',
            value: studentsTaught,
            note: 'distinct students',
          },
        ]}
      />

      <h2 className="type-title mb-4 text-[15px] text-ink">Sessions</h2>

      {history.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Register for a session, teach, and record what you covered while you are at the school. It will show up here."
        />
      ) : (
        <Spine>
          {history.map((record, index) => (
            <SpineEntry key={index} state="done">
              <p className="text-sm font-medium text-ink">{record.session.title}</p>
              <p className="text-[13px] text-ink-2">
                {formatDay(record.session.startTime)}, {formatTime(record.session.startTime)}
                <span className="text-ink-3">
                  {' · '}
                  {record.students.length}{' '}
                  {record.students.length === 1 ? 'child' : 'children'}
                </span>
              </p>

              <ul className="mt-3 divide-y divide-rule rounded-lg border border-rule bg-surface">
                {record.students.map((student, idx) => (
                  <li
                    key={idx}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-ink">
                      {student.name}{' '}
                      <span className="text-ink-3">{student.grade}</span>
                    </span>
                    <span className="text-[13px] text-ink-2">
                      {student.subject}
                      {student.topic ? `, ${student.topic}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </SpineEntry>
          ))}
        </Spine>
      )}
    </Layout>
  );
}
