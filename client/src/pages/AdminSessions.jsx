import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { attendanceSessionAPI } from '../utils/api';

// Component to display active code with countdown
function ActiveCodeDisplay({ session, onRefresh }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!session.codeExpiry) return 0;
      const diff = new Date(session.codeExpiry) - new Date();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      
      if (newTimeLeft === 0) {
        onRefresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session.codeExpiry, onRefresh]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isExpiringSoon = timeLeft < 120; // Less than 2 minutes

  // Check if session is currently active
  const now = new Date();
  const isSessionActive = now >= new Date(session.startTime) && now <= new Date(session.endTime);

  if (!isSessionActive) {
    return (
      <div className="rounded-lg p-4 border-2 bg-[#fafafa] border-[#e4e4e4]">
        <p className="text-sm text-[#6b6b6b] text-center">
          Code will appear automatically when session starts
        </p>
      </div>
    );
  }

  if (!session.activeCode || timeLeft === 0) {
    return (
      <div className="rounded-lg p-4 border-2 bg-[#fff7ed] border-[#fb923c]">
        <p className="text-sm text-[#ea580c] text-center">
          Generating new code...
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 border-2 ${
      isExpiringSoon 
        ? 'bg-[#fff7ed] border-[#fb923c]' 
        : 'bg-[#f0fdf4] border-[#86efac]'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#6b6b6b] mb-1">Active Code</p>
          <p className="text-3xl font-bold font-mono tracking-wider text-[#111111]">
            {session.activeCode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#6b6b6b] mb-1">Expires in</p>
          <p className={`text-2xl font-bold font-mono ${
            isExpiringSoon ? 'text-[#ea580c]' : 'text-[#16a34a]'
          }`}>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: ''
  });

  useEffect(() => {
    fetchSessions();
    
    // Auto-refresh every 30 seconds to get new codes
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // For testing: Create session starting now and ending 3 hours later
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // 3 hours later

      const payload = {
        title: formData.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      };

      await attendanceSessionAPI.create(payload);
      setShowModal(false);
      setFormData({ title: '', date: '' });
      fetchSessions();
      alert('Session created successfully! Active now for 3 hours.');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create session');
    }
  };

  const handleDelete = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await attendanceSessionAPI.delete(sessionId);
      fetchSessions();
      alert('Session deleted successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete session');
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111111]">
            Manage Attendance Sessions
          </h1>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all"
          >
            + Create Session
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-8 sm:p-12 text-center">
            <p className="text-[#6b6b6b] text-sm mb-4">No sessions yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all"
            >
              Create First Session
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {sessions.map((session) => (
              <div
                key={session._id}
                className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-[15px] font-semibold text-[#111111] mb-3">
                        {session.title}
                      </h3>

                      <div className="text-xs sm:text-[13px] text-[#6b6b6b] space-y-1 mb-3">
                        <p>
                          <span className="font-medium">Start:</span> {formatDateTime(session.startTime)}
                        </p>
                        <p>
                          <span className="font-medium">End:</span> {formatDateTime(session.endTime)}
                        </p>
                      </div>

                      <ActiveCodeDisplay session={session} onRefresh={fetchSessions} />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => handleDelete(session._id)}
                        className="h-11 sm:h-9 px-4 bg-white border border-[#e4e4e4] text-[#dc2626] text-sm font-medium rounded-md hover:bg-[#fef2f2] transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Create Session Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Create Attendance Session"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Session Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Weekend Learning Session"
              required
            />

            <div className="bg-[#fff7ed] border border-[#fed7aa] rounded-lg p-4">
              <p className="text-xs text-[#c2410c] font-medium mb-1">
                🧪 Testing Mode
              </p>
              <p className="text-xs text-[#6b6b6b]">
                Session will start immediately and run for 3 hours. Code will appear automatically.
              </p>
            </div>

            <div className="bg-[#f7f7f6] border border-[#e4e4e4] rounded-lg p-4">
              <p className="text-xs text-[#6b6b6b]">
                📍 Location validation is enabled (500m radius from school)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="h-9 px-4 bg-white border border-[#e4e4e4] text-[#111111] text-[13px] font-medium rounded-md hover:bg-[#fafafa] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors"
              >
                Create Session
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
