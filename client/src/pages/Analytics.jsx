import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import StatStrip from '../components/StatStrip';
import EmptyState from '../components/EmptyState';
import {
  AXIS,
  ChartFrame,
  ChartTooltip,
  GRID,
  Legend,
  SERIES,
} from '../components/Chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { isLive } from '../utils/session';

const tickStyle = { fontSize: 12, fill: AXIS, fontFamily: 'Archivo, sans-serif' };

function rankBy(logs, pick, limit = 8) {
  const counts = {};
  logs.forEach((log) => {
    const key = pick(log);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, lessons]) => ({ name, lessons }));
}

export default function Analytics() {
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ volunteers: 0, students: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sessionsRes, logsRes, usersRes, studentsRes] = await Promise.all([
          api.get('/attendance-sessions'),
          api.get('/teaching-logs'),
          api.get('/users'),
          api.get('/students'),
        ]);
        setSessions(sessionsRes.data.data || []);
        setLogs(logsRes.data.data || []);
        setCounts({
          volunteers: (usersRes.data.data || []).filter((u) => u.role === 'volunteer')
            .length,
          students: (studentsRes.data.data || []).length,
        });
      } catch {
        setSessions([]);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activity = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const key = date.toDateString();

      const dayLogs = logs.filter(
        (log) => new Date(log.timestamp).toDateString() === key
      );

      days.push({
        date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        lessons: dayLogs.length,
        children: new Set(dayLogs.map((l) => l.studentId?._id)).size,
      });
    }
    return days;
  }, [logs]);

  const subjects = useMemo(() => rankBy(logs, (l) => l.subject, 8), [logs]);
  const volunteers = useMemo(
    () => rankBy(logs, (l) => l.volunteerId?.name, 8),
    [logs]
  );
  const students = useMemo(() => rankBy(logs, (l) => l.studentId?.name, 8), [logs]);

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Reading the register" />
      </Layout>
    );
  }

  const hasActivity = activity.some((d) => d.lessons > 0);

  return (
    <Layout>
      <PageHeader
        title="Insights"
        lede="What the register adds up to: how often the club teaches, who turns up, and which children are being reached."
      />

      <StatStrip
        className="mb-8"
        items={[
          { label: 'Lessons recorded', value: logs.length },
          { label: 'Children enrolled', value: counts.students },
          { label: 'Volunteers', value: counts.volunteers },
          {
            label: 'Sessions run',
            value: sessions.length,
            note: sessions.some(isLive) ? 'one running now' : undefined,
            accent: sessions.some(isLive),
          },
        ]}
      />

      {logs.length === 0 ? (
        <EmptyState
          title="Nothing to measure yet"
          description="Once volunteers start recording lessons, this page shows how the club's teaching adds up over time."
        />
      ) : (
        <div className="space-y-6">
          <ChartFrame
            title="Teaching over the last 30 days"
            note="Lessons recorded each day, and how many different children they reached."
            empty={!hasActivity}
            emptyNote="No lessons were recorded in the last 30 days."
          >
            <Legend
              items={[
                { label: 'Lessons', color: SERIES.primary },
                { label: 'Children reached', color: SERIES.secondary },
              ]}
            />
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={activity} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: AXIS, strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Line
                  type="monotone"
                  dataKey="lessons"
                  name="Lessons"
                  stroke={SERIES.primary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="children"
                  name="Children reached"
                  stroke={SERIES.secondary}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#FFFFFF' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartFrame
              title="Subjects taught"
              note="Lessons recorded per subject."
              empty={subjects.length === 0}
              emptyNote="No subjects recorded yet."
            >
              <RankedBars data={subjects} />
            </ChartFrame>

            <ChartFrame
              title="Volunteers by lessons taught"
              note="The eight who have recorded the most."
              empty={volunteers.length === 0}
              emptyNote="No volunteer activity yet."
            >
              <RankedBars data={volunteers} />
            </ChartFrame>
          </div>

          <ChartFrame
            title="Children reached most often"
            note="The eight students with the most recorded lessons."
            empty={students.length === 0}
            emptyNote="No student activity yet."
          >
            <RankedBars data={students} />
          </ChartFrame>
        </div>
      )}
    </Layout>
  );
}

// One measure, one hue — magnitude compared across a ranked list.
function RankedBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34 + 24)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={104}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F2EE' }} />
        <Bar
          dataKey="lessons"
          name="Lessons"
          fill={SERIES.primary}
          radius={[0, 4, 4, 0]}
          barSize={14}
          isAnimationActive={false}
          label={{
            position: 'right',
            fill: AXIS,
            fontSize: 12,
            fontFamily: 'Archivo, sans-serif',
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
