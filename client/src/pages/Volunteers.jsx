import { useState, useEffect } from 'react';
import api from '../utils/api';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Input from '../components/Input';

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'volunteer123',
    phone: ''
  });

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await api.get('/users');
      setVolunteers(response.data.data.filter(u => u.role === 'volunteer'));
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', { ...formData, role: 'volunteer' });
      setShowModal(false);
      setFormData({ name: '', email: '', password: 'volunteer123', phone: '' });
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating volunteer:', error);
      alert('Failed to create volunteer');
    }
  };

  const getAttendancePercentage = (volunteer) => {
    // Calculate attendance percentage based on total events
    const attended = volunteer.attendance?.length || 0;
    // In a real scenario, you'd compare against total events
    return attended;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading volunteers...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[22px] font-semibold text-[#111111]">Volunteers</h1>
          <button
            onClick={() => setShowModal(true)}
            className="h-8 px-4 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors"
          >
            Add Volunteer
          </button>
        </div>

        {volunteers.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-12 text-center">
            <p className="text-[#6b6b6b] text-sm mb-4">No volunteers yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="h-8 px-4 bg-[#111111] text-white text-[13px] font-medium rounded-md hover:bg-[#2a2a2a] transition-colors"
            >
              Add Volunteer
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#e4e4e4] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f7f7f6] border-b border-[#e4e4e4]">
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                    Events Attended
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((volunteer) => (
                  <tr
                    key={volunteer._id}
                    className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-[#111111] font-medium">
                      {volunteer.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#111111]">
                      {volunteer.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#111111]">
                      {volunteer.phone || (
                        <span className="text-[#9a9a9a]">Not provided</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#111111]">
                      {getAttendancePercentage(volunteer)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]">
                        active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Volunteer Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Add New Volunteer"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <Input
              label="Phone (Optional)"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                Add Volunteer
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
