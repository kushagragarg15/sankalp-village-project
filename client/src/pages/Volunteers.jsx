import { useState, useEffect } from 'react';
import { volunteerAttendanceAPI } from '../utils/api';
import Layout from '../components/Layout';

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await volunteerAttendanceAPI.getAll();
      setVolunteers(response.data.data);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111111]">Volunteers</h1>
        </div>

        {volunteers.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-8 sm:p-12 text-center">
            <p className="text-[#6b6b6b] text-sm">No volunteers yet</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {volunteers.map((volunteer) => (
                <div
                  key={volunteer._id}
                  className="bg-white border border-[#e4e4e4] rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111111] text-white text-sm font-bold">
                          #{volunteer.rank}
                        </span>
                        <h3 className="text-sm font-semibold text-[#111111]">{volunteer.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]">
                          {volunteer.sessionsAttended} sessions
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-[#6b6b6b] space-y-1 mb-3">
                    <p>
                      <span className="text-[#9a9a9a]">Email:</span>{' '}
                      <span className="break-all">{volunteer.email}</span>
                    </p>
                    <p>
                      <span className="text-[#9a9a9a]">Phone:</span>{' '}
                      {volunteer.phone || <span className="text-[#9a9a9a]">Not provided</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-white border border-[#e4e4e4] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr className="bg-[#f7f7f6] border-b border-[#e4e4e4]">
                      <th className="text-left px-4 py-3 text-[11px] uppercase tracking-wider text-[#9a9a9a] font-medium">
                        Rank
                      </th>
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
                        Sessions Attended
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((volunteer) => (
                      <tr
                        key={volunteer._id}
                        className="border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111111] text-white text-sm font-bold">
                            #{volunteer.rank}
                          </span>
                        </td>
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
                        <td className="px-4 py-3 text-sm text-[#111111] font-semibold">
                          {volunteer.sessionsAttended}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
