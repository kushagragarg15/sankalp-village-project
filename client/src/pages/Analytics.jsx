import { useState, useEffect } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/events')
      ]);

      setStats(statsRes.data.data);
      setEvents(eventsRes.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading analytics...</p>
        </div>
      </Layout>
    );
  }

  // Prepare volunteer attendance trend data (last 10 events)
  const volunteerAttendanceTrend = events
    .filter(e => e.status === 'completed')
    .slice(0, 10)
    .reverse()
    .map((event) => ({
      date: new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volunteers: event.volunteersPresent?.length || 0
    }));

  // Prepare events per month data (last 6 months)
  const eventsPerMonth = {};
  events.forEach(event => {
    const month = new Date(event.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    eventsPerMonth[month] = (eventsPerMonth[month] || 0) + 1;
  });
  const eventsPerMonthData = Object.entries(eventsPerMonth).map(([month, count]) => ({
    month,
    events: count
  })).slice(-6);

  // Calculate subject distribution from all teaching sessions
  const subjectDistribution = {};
  events.forEach(event => {
    event.sessions?.forEach(session => {
      subjectDistribution[session.subject] = (subjectDistribution[session.subject] || 0) + 1;
    });
  });
  const subjectData = Object.entries(subjectDistribution).map(([subject, count]) => ({
    subject,
    sessions: count
  }));

  return (
    <Layout>
      <div className="max-w-7xl">
        <h1 className="text-[22px] font-semibold text-[#111111] mb-5">Impact Analytics</h1>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-6">
            <p className="text-xs uppercase tracking-wider text-[#6b6b6b] mb-2">Total Volunteers</p>
            <p className="text-[32px] font-semibold text-[#111111]">
              {stats?.totalVolunteers || 0}
            </p>
          </div>

          <div className="bg-white border border-[#e4e4e4] rounded-lg p-6">
            <p className="text-xs uppercase tracking-wider text-[#6b6b6b] mb-2">Total Students</p>
            <p className="text-[32px] font-semibold text-[#111111]">
              {stats?.totalStudents || 0}
            </p>
          </div>

          <div className="bg-white border border-[#e4e4e4] rounded-lg p-6">
            <p className="text-xs uppercase tracking-wider text-[#6b6b6b] mb-2">Events This Month</p>
            <p className="text-[32px] font-semibold text-[#111111]">
              {stats?.eventsThisMonth || 0}
            </p>
          </div>
        </div>

        {/* Volunteer Attendance Trend */}
        <div className="bg-white border border-[#e4e4e4] rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#111111] mb-5">Volunteer Attendance Trend</h2>
          {volunteerAttendanceTrend.length === 0 ? (
            <p className="text-[#6b6b6b] text-center py-8 text-sm">No attendance data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volunteerAttendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <YAxis stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e4',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="volunteers"
                  stroke="#111111"
                  strokeWidth={1.5}
                  dot={{ fill: '#111111', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Events Per Month */}
        <div className="bg-white border border-[#e4e4e4] rounded-lg p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#111111] mb-5">Events Per Month</h2>
          {eventsPerMonthData.length === 0 ? (
            <p className="text-[#6b6b6b] text-center py-8 text-sm">No event data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventsPerMonthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <YAxis stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e4',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                />
                <Bar dataKey="events" fill="#111111" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Teaching Sessions by Subject */}
        <div className="bg-white border border-[#e4e4e4] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-[#111111] mb-5">Teaching Sessions by Subject</h2>
          {subjectData.length === 0 ? (
            <p className="text-[#6b6b6b] text-center py-8 text-sm">
              No teaching session data available yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="subject" stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <YAxis stroke="#9a9a9a" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e4',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}
                />
                <Bar dataKey="sessions" fill="#111111" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
}
