import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import StatStrip from '../components/StatStrip';
import Button from '../components/Button';
import { Select } from '../components/Input';
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/Table';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { formatDayLong, formatStamp, formatTime } from '../utils/session';

export default function AttendanceReport() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/attendance-sessions');
        setSessions(response.data.data || []);
      } catch {
        toast.blocked('Sessions could not be loaded.');
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const response = await api.get(`/teaching-logs/session/${selected}`);
        if (!cancelled) setLogs(response.data.data || []);
      } catch {
        if (!cancelled) {
          setLogs([]);
          toast.blocked('That session report could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const session = sessions.find((s) => s._id === selected);

  const stats = useMemo(() => {
    if (logs.length === 0) return null;
    return {
      entries: logs.length,
      students: new Set(logs.map((l) => l.studentId?._id)).size,
      volunteers: new Set(logs.map((l) => l.volunteerId?._id)).size,
      subjects: new Set(logs.map((l) => l.subject)).size,
    };
  }, [logs]);

  const byDate = useMemo(() => {
    return logs.reduce((acc, log) => {
      const key = formatDayLong(log.timestamp);
      (acc[key] = acc[key] || []).push(log);
      return acc;
    }, {});
  }, [logs]);

  const downloadCSV = () => {
    if (logs.length === 0 || !session) return;

    const headers = [
      'Date',
      'Session',
      'Student',
      'Class',
      'Volunteer',
      'Volunteer email',
      'Subject',
      'Topic',
      'Time',
      'Latitude',
      'Longitude',
    ];

    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleDateString('en-IN'),
      session.title,
      log.studentId?.name,
      log.studentId?.grade,
      log.volunteerId?.name,
      log.volunteerId?.email,
      log.subject,
      log.topic,
      new Date(log.timestamp).toLocaleTimeString('en-IN'),
      log.lat ?? '',
      log.lng ?? '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sankalp-attendance-${session.title.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.done('CSV downloaded.');
  };

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        lede="Everything volunteers recorded in a session: who taught which child, what was covered, and when."
        actions={
          logs.length > 0 && (
            <Button variant="secondary" onClick={downloadCSV}>
              Download CSV
            </Button>
          )
        }
      />

      <div className="mb-8 sm:max-w-md">
        <Select
          label="Session"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a session</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.title} — {formatStamp(s.startTime)}
            </option>
          ))}
        </Select>
      </div>

      {!selected && (
        <EmptyState
          title="Pick a session"
          description="Choose one above to see every lesson recorded against it."
        />
      )}

      {loading && <LoadingState label="Loading the report" />}

      {!loading && selected && logs.length === 0 && (
        <EmptyState
          title="Nothing was recorded"
          description="No volunteer submitted attendance for this session. If that looks wrong, check the session ran inside its window and that volunteers were registered."
        />
      )}

      {!loading && stats && (
        <>
          <StatStrip
            className="mb-8"
            items={[
              { label: 'Lessons recorded', value: stats.entries },
              { label: 'Children taught', value: stats.students },
              { label: 'Volunteers', value: stats.volunteers },
              { label: 'Subjects', value: stats.subjects },
            ]}
          />

          <div className="space-y-8">
            {Object.entries(byDate).map(([date, dayLogs]) => (
              <section key={date}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
                  <h2 className="type-title text-[15px] text-ink">{date}</h2>
                  <span className="text-[13px] text-ink-2 tabular-nums">
                    {dayLogs.length} {dayLogs.length === 1 ? 'lesson' : 'lessons'}
                  </span>
                </div>

                <div className="rounded-lg border border-rule bg-surface overflow-hidden">
                  <Table minWidth={720}>
                    <TableHead>
                      <tr>
                        <TableHeader className="w-20">Time</TableHeader>
                        <TableHeader>Student</TableHeader>
                        <TableHeader>Class</TableHeader>
                        <TableHeader>Volunteer</TableHeader>
                        <TableHeader>Subject</TableHeader>
                        <TableHeader>Topic</TableHeader>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {dayLogs.map((log, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-[13px] text-ink-2 tabular-nums">
                            {formatTime(log.timestamp)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.studentId?.name}
                          </TableCell>
                          <TableCell className="text-ink-2">
                            {log.studentId?.grade}
                          </TableCell>
                          <TableCell>{log.volunteerId?.name}</TableCell>
                          <TableCell>{log.subject}</TableCell>
                          <TableCell className="text-ink-2">{log.topic}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
