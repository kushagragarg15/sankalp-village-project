import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { attendanceSessionAPI, registrationAPI } from '../utils/api';

export default function VolunteerSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsRes, registrationsRes] = await Promise.all([
        attendanceSessionAPI.getAll(),
        registrationAPI.getMyRegistrations()
      ]);

      setSessions(sessionsRes.data.data);
      setMyRegistrations(registrationsRes.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (sessionId) => {
    setRegistering(sessionId);
    try {
      await registrationAPI.register(sessionId);
      await fetchData(); // Refresh data
      alert('Successfully registered for session!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to register');
    } finally {
      setRegistering(null);
    }
  };

  const isRegistered = (sessionId) => {
    return myRegistrations.some(reg => reg.sessionId?._id === sessionId);
  };

  const isSessionActive = (session) => {
    const now = new Date();
    return now >= new Date(session.startTime) && now <= new Date(session.endTime);
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading sessions...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#111111] mb-4 sm:mb-6">
          Attendance Sessions
        </h1>

        {sessions.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-8 sm:p-12 text-center">
            <p className="text-[#6b6b6b] text-sm">No sessions available</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {sessions.map((session) => {
              const registered = isRegistered(session._id);
              const active = isSessionActive(session);

              return (
                <div
                  key={session._id}
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-sm sm:text-[15px] font-semibold text-[#111111]">
                          {session.title}
                        </h3>
                        {active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]">
                            Active Now
                          </span>
                        )}
                        {registered && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                            Registered
                          </span>
                        )}
                      </div>

                      <div className="text-xs sm:text-[13px] text-[#6b6b6b] space-y-1">
                        <p>
                          <span className="font-medium">Start:</span> {formatDateTime(session.startTime)}
                        </p>
                        <p>
                          <span className="font-medium">End:</span> {formatDateTime(session.endTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      {!registered ? (
                        <button
                          onClick={() => handleRegister(session._id)}
                          disabled={registering === session._id}
                          className="h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {registering === session._id ? 'Registering...' : 'Register'}
                        </button>
                      ) : active ? (
                        <button
                          onClick={() => navigate(`/attendance/${session._id}`)}
                          className="h-11 sm:h-9 px-4 bg-[#3a7d44] text-white text-sm font-medium rounded-md hover:bg-[#2d6335] active:scale-[0.98] transition-all"
                        >
                          Submit Attendance
                        </button>
                      ) : (
                        <button
                          disabled
                          className="h-11 sm:h-9 px-4 bg-[#e4e4e4] text-[#6b6b6b] text-sm font-medium rounded-md cursor-not-allowed"
                        >
                          Session Ended
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
