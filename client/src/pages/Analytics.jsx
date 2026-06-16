import { useState, useEffect } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Analytics() {
  const [stats, setStats] = useState({
    totalVolunteers: 0,
    totalStudents: 0,
    totalSessions: 0,
    totalTeachingLogs: 0,
    activeSessions: 0
  });
  const [sessions, setSessions] = useState([]);
  const [teachingLogs, setTeachingLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [sessionsRes, logsRes, volunteersRes, studentsRes] = await Promise.all([
        api.get('/attendance-sessions'),
        api.get('/teaching-logs'),
        api.get('/users'),
        api.get('/students')
      ]);

      setSessions(sessionsRes.data.data);
      setTeachingLogs(logsRes.data.data);

      // Calculate stats
      const volunteers = volunteersRes.data.data.filter(u => u.role === 'volunteer');
      const now = new Date();
      const activeSessions = sessionsRes.data.data.filter(s => 
        now >= new Date(s.startTime) && now <= new Date(s.endTime)
      );

      setStats({
        totalVolunteers: volunteers.length,
        totalStudents: studentsRes.data.data.length,
        totalSessions: sessionsRes.data.data.length,
        totalTeachingLogs: logsRes.data.data.length,
        activeSessions: activeSessions.length
      });
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

  // Teaching activity by date (last 30 days)
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const logsForDate = teachingLogs.filter(log => {
      const logDate = new Date(log.timestamp).toISOString().split('T')[0];
      return logDate === dateStr;
    });

    last30Days.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      logs: logsForDate.length,
      students: new Set(logsForDate.map(l => l.studentId?._id)).size
    });
  }

  // Subject distribution
  const subjectCounts = {};
  teachingLogs.forEach(log => {
    subjectCounts[log.subject] = (subjectCounts[log.subject] || 0) + 1;
  });
  const subjectData = Object.entries(subjectCounts).map(([subject, count]) => ({
    subject,
    count,
    percentage: Math.round((count / teachingLogs.length) * 100)
  }));

  // Volunteer activity (top 10)
  const volunteerCounts = {};
  teachingLogs.forEach(log => {
    const volName = log.volunteerId?.name || 'Unknown';
    volunteerCounts[volName] = (volunteerCounts[volName] || 0) + 1;
  });
  const topVolunteers = Object.entries(volunteerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, sessions: count }));

  // Student engagement (students with most sessions)
  const studentCounts = {};
  teachingLogs.forEach(log => {
    const studentName = log.studentId?.name || 'Unknown';
    studentCounts[studentName] = (studentCounts[studentName] || 0) + 1;
  });
  const topStudents = Object.entries(studentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, sessions: count }));

  // Chart colors
  const COLORS = ['#1A1A1A', '#3D3D3D', '#666666', '#888888', '#AAAAAA'];

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Analytics Dashboard</h1>
          <p className="text-sm text-zinc-500">Real-time teaching insights</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-zinc-500 mb-1">Total Volunteers</p>
            <p className="text-3xl font-semibold text-zinc-900">{stats.totalVolunteers}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-zinc-500 mb-1">Total Students</p>
            <p className="text-3xl font-semibold text-zinc-900">{stats.totalStudents}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-zinc-500 mb-1">Total Sessions</p>
            <p className="text-3xl font-semibold text-zinc-900">{stats.totalSessions}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-zinc-500 mb-1">Teaching Logs</p>
            <p className="text-3xl font-semibold text-zinc-900">{stats.totalTeachingLogs}</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-zinc-500 mb-1">Active Now</p>
            <p className="text-3xl font-semibold text-emerald-600">{stats.activeSessions}</p>
          </div>
        </div>

        {/* Teaching Activity Trend */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Teaching Activity (Last 30 Days)</h2>
          {last30Days.filter(d => d.logs > 0).length === 0 ? (
            <p className="text-zinc-500 text-center py-8 text-sm">No teaching activity in the last 30 days</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={last30Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#999" 
                  style={{ fontSize: '11px' }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#999" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="logs"
                  name="Teaching Logs"
                  stroke="#1A1A1A"
                  strokeWidth={2}
                  dot={{ fill: '#1A1A1A', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="students"
                  name="Unique Students"
                  stroke="#666666"
                  strokeWidth={2}
                  dot={{ fill: '#666666', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject Distribution & Top Volunteers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Subject Distribution */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Subject Distribution</h2>
            {subjectData.length === 0 ? (
              <p className="text-zinc-500 text-center py-8 text-sm">No subject data available</p>
            ) : (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={subjectData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ subject, percentage }) => `${subject} (${percentage}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {subjectData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top Active Volunteers */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Top Active Volunteers</h2>
            {topVolunteers.length === 0 ? (
              <p className="text-zinc-500 text-center py-8 text-sm">No volunteer data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topVolunteers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#999" style={{ fontSize: '11px' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#999" 
                    style={{ fontSize: '11px' }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="sessions" fill="#1A1A1A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Most Engaged Students */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">Most Engaged Students</h2>
          {topStudents.length === 0 ? (
            <p className="text-zinc-500 text-center py-8 text-sm">No student engagement data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topStudents}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  stroke="#999" 
                  style={{ fontSize: '11px' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#999" style={{ fontSize: '11px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="sessions" fill="#1A1A1A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary Insights */}
        {teachingLogs.length > 0 && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 mt-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Key Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-zinc-600">Average sessions per volunteer</p>
                <p className="text-2xl font-semibold text-zinc-900 mt-1">
                  {stats.totalVolunteers > 0 
                    ? Math.round(stats.totalTeachingLogs / stats.totalVolunteers) 
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-zinc-600">Average sessions per student</p>
                <p className="text-2xl font-semibold text-zinc-900 mt-1">
                  {stats.totalStudents > 0 
                    ? Math.round(stats.totalTeachingLogs / stats.totalStudents) 
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-zinc-600">Most popular subject</p>
                <p className="text-2xl font-semibold text-zinc-900 mt-1">
                  {subjectData.length > 0 ? subjectData[0].subject : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
