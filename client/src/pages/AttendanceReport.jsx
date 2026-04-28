import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { Select } from '../components/Input';
import api from '../utils/api';

export default function AttendanceReport() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchAttendanceData();
    }
  }, [selectedSession]);

  const fetchSessions = async () => {
    try {
      const response = await api.get('/attendance-sessions');
      setSessions(response.data.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/teaching-logs/session/${selectedSession}`);
      const logs = response.data.data;
      setAttendanceData(logs);
      calculateStats(logs);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (logs) => {
    const uniqueStudents = new Set(logs.map(log => log.studentId._id));
    const uniqueVolunteers = new Set(logs.map(log => log.volunteerId._id));
    const subjects = {};

    logs.forEach(log => {
      subjects[log.subject] = (subjects[log.subject] || 0) + 1;
    });

    setStats({
      totalEntries: logs.length,
      uniqueStudents: uniqueStudents.size,
      uniqueVolunteers: uniqueVolunteers.size,
      subjects
    });
  };

  const downloadCSV = () => {
    if (attendanceData.length === 0) {
      alert('No data to download');
      return;
    }

    // Get session info
    const session = sessions.find(s => s._id === selectedSession);
    const sessionDate = new Date(session.startTime).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');

    // Prepare CSV headers
    const headers = [
      'Date',
      'Session Name',
      'Student Name',
      'Grade',
      'Volunteer Name',
      'Volunteer Email',
      'Subject',
      'Topic',
      'Time',
      'Location (Lat)',
      'Location (Lng)'
    ];

    // Prepare CSV rows
    const rows = attendanceData.map(log => [
      new Date(log.timestamp).toLocaleDateString('en-US'),
      session.title,
      log.studentId.name,
      log.studentId.grade,
      log.volunteerId.name,
      log.volunteerId.email,
      log.subject,
      log.topic,
      new Date(log.timestamp).toLocaleTimeString('en-US'),
      log.lat || 'N/A',
      log.lng || 'N/A'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${session.title.replace(/\s+/g, '_')}_${sessionDate}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group attendance by date
  const groupedByDate = attendanceData.reduce((acc, log) => {
    const date = new Date(log.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Attendance Report
          </h1>
          {attendanceData.length > 0 && (
            <Button onClick={downloadCSV}>
              📥 Download CSV
            </Button>
          )}
        </div>

        {/* Session Selector */}
        <Card className="mb-6">
          <CardBody>
            <Select
              label="Select Session"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              <option value="">-- Choose a session --</option>
              {sessions.map(session => (
                <option key={session._id} value={session._id}>
                  {session.title} - {formatDateTime(session.startTime)}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-zinc-500">Loading attendance data...</p>
          </div>
        )}

        {!loading && selectedSession && attendanceData.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-zinc-500 text-center py-8">
                No attendance records found for this session
              </p>
            </CardBody>
          </Card>
        )}

        {!loading && stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardBody>
                  <p className="text-sm text-zinc-500 mb-1">Total Entries</p>
                  <p className="text-3xl font-semibold text-zinc-900">
                    {stats.totalEntries}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <p className="text-sm text-zinc-500 mb-1">Students</p>
                  <p className="text-3xl font-semibold text-zinc-900">
                    {stats.uniqueStudents}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <p className="text-sm text-zinc-500 mb-1">Volunteers</p>
                  <p className="text-3xl font-semibold text-zinc-900">
                    {stats.uniqueVolunteers}
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <p className="text-sm text-zinc-500 mb-1">Subjects</p>
                  <p className="text-3xl font-semibold text-zinc-900">
                    {Object.keys(stats.subjects).length}
                  </p>
                </CardBody>
              </Card>
            </div>

            {/* Date-wise Attendance */}
            <Card>
              <CardHeader>
                <CardTitle>Date-wise Attendance</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {Object.entries(groupedByDate).map(([date, logs]) => (
                    <div key={date}>
                      <h3 className="font-semibold text-zinc-900 mb-3 pb-2 border-b border-zinc-200">
                        {date} ({logs.length} entries)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200">
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Time</th>
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Student</th>
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Grade</th>
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Volunteer</th>
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Subject</th>
                              <th className="text-left py-2 px-3 text-zinc-600 font-medium">Topic</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log, index) => (
                              <tr key={index} className="border-b border-zinc-100 hover:bg-zinc-50">
                                <td className="py-2 px-3 text-zinc-900">
                                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td className="py-2 px-3 text-zinc-900">{log.studentId.name}</td>
                                <td className="py-2 px-3 text-zinc-600">{log.studentId.grade}</td>
                                <td className="py-2 px-3 text-zinc-900">{log.volunteerId.name}</td>
                                <td className="py-2 px-3 text-zinc-900">{log.subject}</td>
                                <td className="py-2 px-3 text-zinc-600">{log.topic}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
