import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';

export default function MyAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ attended: 0, total: 0, percentage: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      // Get user's attendance from their profile
      const userResponse = await api.get('/auth/me');
      const userAttendance = userResponse.data.data.attendance || [];

      // Get all completed events to calculate percentage
      const eventsResponse = await api.get('/events?status=completed');
      const totalEvents = eventsResponse.data.count;

      // Fetch full event details for attended events
      const attendedEvents = await Promise.all(
        userAttendance.map(async (att) => {
          try {
            const eventResponse = await api.get(`/events/${att.event}`);
            return {
              ...eventResponse.data.data,
              checkInTime: att.checkInTime,
              checkInMethod: att.checkInMethod
            };
          } catch (error) {
            return null;
          }
        })
      );

      const validEvents = attendedEvents.filter(e => e !== null);

      setAttendance(validEvents);
      setStats({
        attended: validEvents.length,
        total: totalEvents,
        percentage: totalEvents > 0 ? Math.round((validEvents.length / totalEvents) * 100) : 0
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCheckInTime = (time) => {
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionsCount = (event) => {
    if (!event.sessions) return 0;
    return event.sessions.filter(s => s.volunteer?.toString() === user.id).length;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading attendance...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-6">My Attendance</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Events Attended</p>
              <p className="text-3xl font-semibold text-zinc-900">{stats.attended}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Total Events</p>
              <p className="text-3xl font-semibold text-zinc-900">{stats.total}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-sm text-zinc-500 mb-1">Attendance Rate</p>
              <p className="text-3xl font-semibold text-zinc-900">{stats.percentage}%</p>
            </CardBody>
          </Card>
        </div>

        {/* Attendance History */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
          </CardHeader>
          <CardBody>
            {attendance.length === 0 ? (
              <EmptyState
                title="No attendance records yet"
                description="Check in to your first event to start tracking attendance"
                action={
                  <a
                    href="/checkin"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Check In to Event
                  </a>
                }
              />
            ) : (
              <div className="space-y-4">
                {attendance.map((event) => (
                  <div
                    key={event._id}
                    className="p-4 border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/events/${event._id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-zinc-900">{event.title}</h3>
                          <Badge variant="success">Attended</Badge>
                        </div>
                        
                        <div className="text-sm text-zinc-600 space-y-1">
                          <p>📅 {formatDate(event.date)}</p>
                          <p>🕐 {event.startTime} - {event.endTime}</p>
                          <p>
                            ✓ Checked in: {formatCheckInTime(event.checkInTime)}
                            {event.checkInMethod && (
                              <Badge variant={event.checkInMethod === 'qr' ? 'success' : 'default'} className="ml-2">
                                {event.checkInMethod === 'qr' ? 'QR' : 'Manual'}
                              </Badge>
                            )}
                          </p>
                          <p>📚 Sessions taught: {getSessionsCount(event)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tips */}
        {stats.percentage < 80 && stats.total > 0 && (
          <Card className="mt-6">
            <CardBody>
              <h3 className="font-semibold text-zinc-900 mb-2">💡 Improve Your Attendance</h3>
              <p className="text-sm text-zinc-600">
                Your attendance rate is {stats.percentage}%. Try to attend more events to increase your impact!
                Regular attendance helps maintain consistency in student learning.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </Layout>
  );
}
