import { useEffect, useMemo, useState } from 'react';
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
import { analyticsAPI } from '../utils/api';

const tickStyle = { fontSize: 12, fill: AXIS, fontFamily: 'Archivo, sans-serif' };

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await analyticsAPI.overview();
        if (!cancelled) setOverview(response.data.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || 'Insights could not be loaded right now.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The server returns only the days that had lessons; fill the rest so the
  // trend line shows the real shape of the month.
  const activity = useMemo(() => {
    if (!overview) return [];
    const byDate = new Map(overview.daily.map((d) => [d.date, d]));
    const days = [];

    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const hit = byDate.get(key);

      days.push({
        date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        lessons: hit?.lessons || 0,
        children: hit?.children || 0,
      });
    }
    return days;
  }, [overview]);

  if (loading) {
    return (
      <Layout>
        <LoadingState label="Reading the register" />
      </Layout>
    );
  }

  const totals = overview?.totals;
  const hasActivity = activity.some((d) => d.lessons > 0);

  return (
    <Layout>
      <PageHeader
        title="Insights"
        lede="What the register adds up to: how often the club teaches, who turns up, and which children are being reached."
      />

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-brick-line bg-brick-wash px-4 py-3">
          <p className="text-sm text-brick">{error}</p>
        </div>
      )}

      {totals && (
        <StatStrip
          className="mb-8"
          items={[
            { label: 'Lessons recorded', value: totals.lessons },
            { label: 'Children enrolled', value: totals.students },
            { label: 'Volunteers', value: totals.volunteers },
            {
              label: 'Sessions run',
              value: totals.sessions,
              note: totals.liveSessions > 0 ? 'one running now' : undefined,
              accent: totals.liveSessions > 0,
            },
          ]}
        />
      )}

      {!totals || totals.lessons === 0 ? (
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
              empty={overview.subjects.length === 0}
              emptyNote="No subjects recorded yet."
            >
              <RankedBars data={overview.subjects} />
            </ChartFrame>

            <ChartFrame
              title="Volunteers by lessons taught"
              note="The eight who have recorded the most."
              empty={overview.volunteers.length === 0}
              emptyNote="No volunteer activity yet."
            >
              <RankedBars data={overview.volunteers} />
            </ChartFrame>
          </div>

          <ChartFrame
            title="Children reached most often"
            note="The eight students with the most recorded lessons."
            empty={overview.students.length === 0}
            emptyNote="No student activity yet."
          >
            <RankedBars data={overview.students} />
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
