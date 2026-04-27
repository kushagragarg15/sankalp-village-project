import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody } from '../components/Card';
import Badge from '../components/Badge';
import Button from '../components/Button';

export default function Dashboard() {
  const { isAdmin, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/analytics/dashboard');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

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
      <div className="max-w-7xl mx-auto">
        <h1 className="text-[22px] font-semibold text-[#111111] mb-5">Dashboard</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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

        {/* Upcoming Events */}
        {stats?.upcomingEvents && stats.upcomingEvents.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#111111] mb-5">
              Upcoming Events
            </h2>
            <div className="space-y-4">
              {stats.upcomingEvents.map((event) => (
                <div
                  key={event._id}
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-[15px] font-medium text-[#111111]">{event.title}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                        {event.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#6b6b6b]">
                      {formatDate(event.date)}, {event.startTime} - {event.endTime}
                    </p>
                    <p className="text-[13px] text-[#6b6b6b]">
                      {event.volunteersPresent?.length || 0} volunteers checked in
                    </p>
                  </div>
                  <a
                    href={`/events/${event._id}`}
                    className="text-[13px] text-[#111111] hover:underline ml-4"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        {stats?.recentEvents && stats.recentEvents.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#111111] mb-5">
              Recent Events
            </h2>
            <div className="space-y-4">
              {stats.recentEvents.map((event) => (
                <div
                  key={event._id}
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#111111] mb-1">{event.title}</p>
                    <p className="text-[13px] text-[#6b6b6b]">
                      {formatDate(event.date)}, {event.startTime} - {event.endTime}
                    </p>
                    <p className="text-[13px] text-[#6b6b6b]">
                      {event.volunteersPresent?.length || 0} volunteers · {event.sessions?.length || 0} sessions
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]">
                    completed
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-[#111111] mb-5">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isAdmin ? (
              <>
                <a
                  href="/events/create"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">Create Event</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    Schedule a new weekend learning session
                  </p>
                </a>
                <a
                  href="/volunteers"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">Manage Volunteers</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    Add or view volunteer information
                  </p>
                </a>
                <a
                  href="/students"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">View Students</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    See all enrolled students
                  </p>
                </a>
              </>
            ) : (
              <>
                <a
                  href="/checkin"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">Check In</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    Scan QR code to check in to event
                  </p>
                </a>
                <a
                  href="/log-session"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">Log Session</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    Record a teaching session
                  </p>
                </a>
                <a
                  href="/ai-notes"
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:bg-[#fafafa] transition-colors"
                >
                  <p className="text-sm font-medium text-[#111111]">Teaching Notes</p>
                  <p className="text-[13px] text-[#6b6b6b] mt-1">
                    Generate lesson plans
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
