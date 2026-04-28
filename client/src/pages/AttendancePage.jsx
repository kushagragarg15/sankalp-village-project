import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { attendanceSessionAPI, getStudents, teachingLogAPI } from '../utils/api';

export default function AttendancePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState({});
  const [code, setCode] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    getLocation();
  }, [sessionId]);

  const fetchData = async () => {
    try {
      const [sessionRes, studentsRes] = await Promise.all([
        attendanceSessionAPI.getOne(sessionId),
        getStudents()
      ]);

      setSession(sessionRes.data.data);
      setStudents(studentsRes.data.data);
    } catch (error) {
      setError('Failed to load data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Location is optional, so we don't show error
        }
      );
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudents(prev => {
      const newSelected = { ...prev };
      if (newSelected[studentId]) {
        delete newSelected[studentId];
      } else {
        newSelected[studentId] = {
          student_id: studentId,
          subject: '',
          topic: ''
        };
      }
      return newSelected;
    });
  };

  const updateStudentData = (studentId, field, value) => {
    setSelectedStudents(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const entries = Object.values(selectedStudents);
    if (entries.length === 0) {
      setError('Please select at least one student');
      return;
    }

    if (!code.trim()) {
      setError('Attendance code is required');
      return;
    }

    // Check all entries have subject and topic
    for (const entry of entries) {
      if (!entry.subject.trim() || !entry.topic.trim()) {
        setError('All selected students must have subject and topic filled');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        session_id: sessionId,
        entries,
        code: code.trim().toUpperCase(),
        lat: location?.lat || null,
        lng: location?.lng || null
      };

      const response = await teachingLogAPI.submit(payload);

      alert(response.data.message);
      navigate('/volunteer-sessions');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Session not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/volunteer-sessions')}
            className="text-sm text-[#6b6b6b] hover:text-[#111111] mb-4"
          >
            ← Back to Sessions
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111111] mb-2">
            Submit Attendance
          </h1>
          <p className="text-sm text-[#6b6b6b]">{session.title}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Attendance Code */}
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6 mb-6">
            <label className="block text-sm font-medium text-[#111111] mb-2">
              Attendance Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter 5-character code"
              maxLength={5}
              className="w-full sm:w-64 h-11 px-4 text-sm border border-[#e4e4e4] rounded-md focus:outline-none focus:border-[#111111]"
              required
            />
            <p className="text-xs text-[#9a9a9a] mt-2">
              Get the code from your session coordinator
            </p>
          </div>

          {/* Student Selection */}
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6 mb-6">
            <h2 className="text-base font-semibold text-[#111111] mb-4">
              Select Students ({Object.keys(selectedStudents).length} selected)
            </h2>

            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search students by name or grade..."
              className="w-full h-11 px-4 text-sm border border-[#e4e4e4] rounded-md focus:outline-none focus:border-[#111111] mb-4"
            />

            {/* Students List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredStudents.map((student) => {
                const isSelected = !!selectedStudents[student._id];

                return (
                  <div
                    key={student._id}
                    className={`border rounded-lg p-4 transition-all ${
                      isSelected
                        ? 'border-[#111111] bg-[#fafafa]'
                        : 'border-[#e4e4e4] hover:border-[#6b6b6b]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStudent(student._id)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-sm text-[#111111]">
                            {student.name}
                          </p>
                          <span className="text-xs text-[#6b6b6b]">
                            {student.grade}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <div>
                              <label className="block text-xs text-[#6b6b6b] mb-1">
                                Subject *
                              </label>
                              <input
                                type="text"
                                value={selectedStudents[student._id].subject}
                                onChange={(e) =>
                                  updateStudentData(student._id, 'subject', e.target.value)
                                }
                                placeholder="e.g., Math"
                                className="w-full h-9 px-3 text-sm border border-[#e4e4e4] rounded-md focus:outline-none focus:border-[#111111]"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#6b6b6b] mb-1">
                                Topic *
                              </label>
                              <input
                                type="text"
                                value={selectedStudents[student._id].topic}
                                onChange={(e) =>
                                  updateStudentData(student._id, 'topic', e.target.value)
                                }
                                placeholder="e.g., Algebra"
                                className="w-full h-9 px-3 text-sm border border-[#e4e4e4] rounded-md focus:outline-none focus:border-[#111111]"
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredStudents.length === 0 && (
              <p className="text-center text-[#6b6b6b] text-sm py-8">
                No students found
              </p>
            )}
          </div>

          {/* Location Status */}
          {location && (
            <div className="bg-[#f0faf2] border border-[#c6e8cc] rounded-lg p-4 mb-6">
              <p className="text-sm text-[#3a7d44]">
                📍 Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/volunteer-sessions')}
              className="h-11 px-6 bg-white border border-[#e4e4e4] text-[#111111] text-sm font-medium rounded-md hover:bg-[#fafafa] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Object.keys(selectedStudents).length === 0}
              className="h-11 px-6 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Attendance'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
