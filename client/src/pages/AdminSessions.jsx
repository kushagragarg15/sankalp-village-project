import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Input from '../components/Input';
import { attendanceSessionAPI } from '../utils/api';

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    lat: '',
    lng: ''
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
      const payload = {
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime
      };

      // Add location if provided
      if (formData.lat && formData.lng) {
        payload.location = {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        };
      }

      await attendanceSessionAPI.create(payload);
      setShowModal(false);
      setFormData({ title: '', startTime: '', endTime: '', lat: '', lng: '' });
      fetchSessions();
      alert('Session created successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create session');
    }
  };

  const handleGenerateCode = async (sessionId) => {
    setGeneratingCode(sessionId);
    try {
      const response = await attendanceSessionAPI.generateCode(sessionId);
      alert(`Code generated: ${response.data.data.code}\nExpires at: ${new Date(response.data.data.expiry).toLocaleTimeString()}`);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCodeActive = (session) => {
    if (!session.activeCode || !session.codeExpiry) return false;
    return new Date() < new Date(session.codeExpiry);
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
            {sessions.map((session) => {
              const codeActive = isCodeActive(session);

              return (
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
                        {session.location?.lat && session.location?.lng && (
                          <p>
                            <span className="font-medium">Location:</span> {session.location.lat.toFixed(4)}, {session.location.lng.toFixed(4)}
                          </p>
                        )}
                      </div>

                      {session.activeCode && (
                        <div className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-mono ${
                          codeActive
                            ? 'bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]'
                            : 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]'
                        }`}>
                          <span className="font-semibold mr-2">Code:</span>
                          {session.activeCode}
                          {codeActive && (
                            <span className="ml-2 text-xs">
                              (expires {new Date(session.codeExpiry).toLocaleTimeString()})
                            </span>
                          )}
                          {!codeActive && (
                            <span className="ml-2 text-xs">(expired)</span>
                          )}
                        </div>
                      )}
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
              );
            })}
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

            <Input
              label="Start Time"
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />

            <Input
              label="End Time"
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
            />

            <div className="border-t border-[#e4e4e4] pt-4">
              <p className="text-sm font-medium text-[#111111] mb-3">
                Location Validation (Optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  placeholder="e.g., 26.9124"
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  placeholder="e.g., 75.7873"
                />
              </div>
              <p className="text-xs text-[#9a9a9a] mt-2">
                If provided, volunteers must be within 200m to submit attendance
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
