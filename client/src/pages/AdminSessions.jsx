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

  if (!session.activeCode || timeLeft === 0) {
    return null;
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
  const [generatingCode, setGeneratingCode] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    date: ''
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Create date objects for 4 PM to 7 PM on the selected date
      const selectedDate = new Date(formData.date);
      
      const startTime = new Date(selectedDate);
      startTime.setHours(16, 0, 0, 0); // 4:00 PM
      
      const endTime = new Date(selectedDate);
      endTime.setHours(19, 0, 0, 0); // 7:00 PM

      const payload = {
        title: formData.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      };

      await attendanceSessionAPI.create(payload);
      setShowModal(false);
      setFormData({ title: '', date: '' });
      fetchSessions();
      alert('Session created successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create session');
    }
  };

  const handleGenerateCode = async (sessionId) => {
    setGeneratingCode(sessionId);
    try {
      await attendanceSessionAPI.generateCode(sessionId);
      fetchSessions();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to generate code');
    } finally {
      setGeneratingCode(null);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
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
                          <span className="font-medium">Date:</span> {formatDate(session.startTime)}
                        </p>
                        <p>
                          <span className="font-medium">Time:</span> 4:00 PM - 7:00 PM
                        </p>
                      </div>

                      <ActiveCodeDisplay session={session} onRefresh={fetchSessions} />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleGenerateCode(session._id)}
                        disabled={generatingCode === session._id}
                        className="h-11 sm:h-9 px-4 bg-[#3a7d44] text-white text-sm font-medium rounded-md hover:bg-[#2d6335] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {generatingCode === session._id ? 'Generating...' : 'Generate Code'}
                      </button>
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

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2">
                Session Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full h-11 px-4 text-sm border border-[#e4e4e4] rounded-md focus:outline-none focus:border-[#111111]"
                required
              />
              <p className="text-xs text-[#9a9a9a] mt-2">
                Session will automatically run from 4:00 PM to 7:00 PM
              </p>
            </div>

            <div className="bg-[#f7f7f6] border border-[#e4e4e4] rounded-lg p-4">
              <p className="text-xs text-[#6b6b6b]">
                📍 Location validation is enabled for all sessions (500m radius from school)
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
