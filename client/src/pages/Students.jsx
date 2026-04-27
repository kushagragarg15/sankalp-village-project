import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Input, { Select } from '../components/Input';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    grade: 'Class 5',
    parentPhone: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/students', formData);
      setShowModal(false);
      setFormData({ name: '', grade: 'Class 5', parentPhone: '' });
      fetchStudents();
    } catch (error) {
      console.error('Error creating student:', error);
      alert('Failed to create student');
    }
  };

  const getEventsAttended = (student) => {
    return student.attendance?.length || 0;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading students...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[22px] font-semibold text-[#111111]">Students</h1>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-4 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors"
          >
            Add Student
          </button>
        </div>

        {students.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-12 text-center">
            <p className="text-[#6b6b6b] text-sm mb-4">No students yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="h-8 px-4 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors"
            >
              Add Student
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e4e4e4] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '700px' }}>
                <thead>
                  <tr className="bg-[#f7f7f6] border-b border-[#e4e4e4]">
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Grade
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Events Attended
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Parent Phone
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Enrollment Date
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student._id}
                      className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-[#111111] font-medium">
                        {student.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                          {student.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#111111]">
                        {getEventsAttended(student)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#111111]">
                        {student.parentPhone || <span className="text-[#9a9a9a]">Not provided</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#111111]">
                        {new Date(student.enrollmentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/students/${student._id}`)}
                          className="text-[13px] text-[#111111] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Student Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Add New Student"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Student Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Select
              label="Grade/Class"
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              required
            >
              <option value="Class 1">Class 1</option>
              <option value="Class 2">Class 2</option>
              <option value="Class 3">Class 3</option>
              <option value="Class 4">Class 4</option>
              <option value="Class 5">Class 5</option>
              <option value="Class 6">Class 6</option>
              <option value="Class 7">Class 7</option>
              <option value="Class 8">Class 8</option>
            </Select>

            <Input
              label="Parent Phone (Optional)"
              type="tel"
              value={formData.parentPhone}
              onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              placeholder="e.g., +91 98765 43210"
            />

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
                Add Student
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
