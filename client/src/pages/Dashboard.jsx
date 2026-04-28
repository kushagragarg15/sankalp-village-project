import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceSessionAPI } from '../utils/api';
import Layout from '../components/Layout';

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await attendanceSessionAPI.getAll();
      setSessions(response.data.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isSessionActive = (session) => {
    const now = new Date();
    return now >= new Date(session.startTime) && now <= new Date(session.endTime);
  };

  const isSessionUpcoming = (session) => {
    const now = new Date();
    return now < new Date(session.startTime);
  };

  const activeSessions = sessions.filter(isSessionActive);
  const upcomingSessions = sessions.filter(isSessionUpcoming).slice(0, 3);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#111111] mb-4 sm:mb-6">
          Dashboard
        </h1>

        {/* Welcome Message */}
        <div className="bg-white border border-[#e4e4e4] rounded-lg p-5 sm:p-6 mb-6">
          <h2 className="text-base sm:text-lg font-semibold text-[#111111] mb-2">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-sm text-[#6b6b6b]">
            {isAdmin 
              ? 'Manage sessions, track volunteer attendance, and monitor student progress.'
              : 'Register for sessions, submit attendance, and track your participation.'}
          </p>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-[#111111] mb-3 sm:mb-4">
              Active Sessions Now
            </h2>
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div
                  key={session._id}
                  className="bg-[#f0fdf4] border-2 border-[#86efac] rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-sm sm:text-[15px] font-semibold text-[#111111]">
                          {session.title}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#16a34a] text-white">
                          ACTIVE NOW
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                        {formatDateTime(session.startTime)} - {formatDateTime(session.endTime)}
                      </p>
                    </div>
                    {!isAdmin && (
                      <a
                        href="/volunteer-sessions"
                        className="inline-flex items-center justify-center h-9 px-4 bg-[#16a34a] text-white text-[13px] font-medium rounded-md hover:bg-[#15803d] transition-colors sm:self-start"
                      >
                        Submit Attendance
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-[#111111] mb-3 sm:mb-4">
              Upcoming Sessions
            </h2>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div
                  key={session._id}
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-[15px] font-medium text-[#111111] mb-2">
                        {session.title}
                      </p>
                      <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                        {formatDateTime(session.startTime)}
                      </p>
                    </div>
                    {!isAdmin && (
                      <a
                        href="/volunteer-sessions"
                        className="inline-flex items-center justify-center h-9 px-4 bg-white border border-[#e4e4e4] text-[#111111] text-[13px] font-medium rounded-md hover:bg-[#fafafa] transition-colors sm:self-start"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Sessions Message */}
        {activeSessions.length === 0 && upcomingSessions.length === 0 && (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-8 sm:p-12 text-center mb-6">
            <p className="text-[#6b6b6b] text-sm mb-4">
              {isAdmin 
                ? 'No active or upcoming sessions. Create a new session to get started.'
                : 'No active or upcoming sessions at the moment.'}
            </p>
            {isAdmin && (
              <a
                href="/admin-sessions"
                className="inline-flex items-center justify-center h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all"
              >
                Create Session
              </a>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#111111] mb-3 sm:mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {isAdmin ? (
              <>
                <a
                  href="/admin-sessions"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">Manage Sessions</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    Create and manage attendance sessions
                  </p>
                </a>
                <a
                  href="/volunteers"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">View Volunteers</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    See volunteer attendance and rankings
                  </p>
                </a>
                <a
                  href="/students"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98] sm:col-span-2 lg:col-span-1"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">View Students</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    See all enrolled students
                  </p>
                </a>
              </>
            ) : (
              <>
                <a
                  href="/volunteer-sessions"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">Attendance Sessions</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    Register and submit attendance
                  </p>
                </a>
                <a
                  href="/my-attendance-new"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98]"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">My Attendance</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    View your attendance history and rank
                  </p>
                </a>
                <a
                  href="/students"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] hover:shadow-sm transition-all active:scale-[0.98] sm:col-span-2 lg:col-span-1"
                >
                  <p className="text-sm font-medium text-[#111111] mb-1">View Students</p>
                  <p className="text-xs sm:text-[13px] text-[#6b6b6b]">
                    See all enrolled students
                  </p>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
