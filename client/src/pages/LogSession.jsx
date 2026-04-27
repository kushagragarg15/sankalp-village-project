import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Input, { Select, Textarea } from '../components/Input';
import Button from '../components/Button';

export default function LogSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    eventId: '',
    subject: 'Math',
    topicCovered: '',
    studentsPresent: [],
    startTime: '',
    endTime: '',
    notes: ''
  });

  useEffect(() => {
    fetchStudents();
    fetchMyEvents();
  }, [user]);

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchMyEvents = async () => {
    try {
      // Get user's attended events
      const userResponse = await api.get('/auth/me');
      const userAttendance = userResponse.data.data.attendance || [];
      
      // Fetch event details for events user checked into
      const events = await Promise.all(
        userAttendance.map(async (att) => {
          try {
            const eventResponse = await api.get(`/events/${att.event}`);
            return eventResponse.data.data;
          } catch (error) {
            return null;
          }
        })
      );
      
      // Filter to only show upcoming and ongoing events
      const validEvents = events.filter(e => 
        e !== null && (e.status === 'upcoming' || e.status === 'ongoing')
      );
      
      setMyEvents(validEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleAttendanceToggle = (studentId) => {
    setFormData((prev) => ({
      ...prev,
      studentsPresent: prev.studentsPresent.includes(studentId)
        ? prev.studentsPresent.filter((id) => id !== studentId)
        : [...prev.studentsPresent, studentId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.eventId) {
      alert('Please select an event');
      return;
    }
    
    setLoading(true);

    try {
      await api.post(`/events/${formData.eventId}/sessions`, {
        subject: formData.subject,
        topicCovered: formData.topicCovered,
        studentsPresent: formData.studentsPresent,
        startTime: formData.startTime,
        endTime: formData.endTime,
        notes: formData.notes
      });

      alert('Session logged successfully!');
      navigate(`/events/${formData.eventId}`);
    } catch (error) {
      console.error('Error logging session:', error);
      alert(error.response?.data?.message || 'Failed to log session');
    } finally {
      setLoading(false);
    }
  };

  if (myEvents.length === 0) {
    return (
      <Layout>
        <div className="max-w-4xl">
          <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Log a Session</h1>
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <p className="text-zinc-500 mb-4">
                  You need to check in to an event before logging a session.
                </p>
                <Button onClick={() => navigate('/checkin')}>
                  Check In to Event
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Log a Teaching Session</h1>

        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Event Selection */}
              <Select
                label="Select Event"
                value={formData.eventId}
                onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                required
              >
                <option value="">Choose an event you checked into</option>
                {myEvents.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.title} - {new Date(event.date).toLocaleDateString()}
                  </option>
                ))}
              </Select>

              {/* Subject and Topic */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                >
                  <option value="Math">Math</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Social Studies">Social Studies</option>
                  <option value="Other">Other</option>
                </Select>

                <Input
                  label="Topic Covered"
                  value={formData.topicCovered}
                  onChange={(e) => setFormData({ ...formData, topicCovered: e.target.value })}
                  placeholder="e.g., Introduction to Fractions"
                  required
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Time (Optional)"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />

                <Input
                  label="End Time (Optional)"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>

              {/* Student Attendance */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-3">
                  Mark Student Attendance ({formData.studentsPresent.length} of {students.length} students)
                </label>
                {students.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-4 text-center bg-zinc-50 rounded-md">
                    No students enrolled yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {students.map((student) => (
                      <label
                        key={student._id}
                        className="flex items-center p-3 border border-zinc-200 rounded-md hover:bg-zinc-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.studentsPresent.includes(student._id)}
                          onChange={() => handleAttendanceToggle(student._id)}
                          className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-3 text-sm text-zinc-900">
                          {student.name}
                          <span className="text-zinc-500 ml-2">({student.grade})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <Textarea
                label="Session Notes (Optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add observations, challenges, or highlights from the session..."
                rows={4}
              />

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Logging Session...' : 'Log Session'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
