import { useState, useEffect } from 'react';
import { volunteerAttendanceAPI } from '../utils/api';
import Layout from '../components/Layout';

export default function MyAttendanceNew() {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await volunteerAttendanceAPI.getMyAttendance();
      setAttendance(response.data.data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading attendance...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#111111] mb-4 sm:mb-6">
          My Attendance
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-[#6b6b6b] mb-1">My Rank</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#111111]">
              #{attendance?.rank || '-'}
            </p>
            <p className="text-xs text-[#9a9a9a] mt-1">
              out of {attendance?.totalVolunteers || 0} volunteers
            </p>
          </div>
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-[#6b6b6b] mb-1">Sessions Attended</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#111111]">
              {attendance?.totalSessions || 0}
            </p>
          </div>
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-[#6b6b6b] mb-1">Status</p>
            <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]">
              Active
            </span>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-[#111111] mb-4">
            Attendance History
          </h2>

          {!attendance?.attendanceHistory || attendance.attendanceHistory.length === 0 ? (
            <p className="text-sm text-[#6b6b6b] text-center py-8">
              No attendance records yet
            </p>
          ) : (
            <div className="space-y-4">
              {attendance.attendanceHistory.map((record, index) => (
                <div
                  key={index}
                  className="border border-[#e4e4e4] rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#111111]">
                        {record.session.title}
                      </h3>
                      <p className="text-xs text-[#6b6b6b] mt-1">
                        {formatDate(record.session.startTime)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc] self-start">
                      Attended
                    </span>
                  </div>

                  <div className="border-t border-[#f0f0f0] pt-3">
                    <p className="text-xs text-[#9a9a9a] mb-2">
                      Students Taught ({record.students.length}):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {record.students.map((student, idx) => (
                        <div
                          key={idx}
                          className="bg-[#fafafa] rounded px-3 py-2 text-xs"
                        >
                          <p className="font-medium text-[#111111]">
                            {student.name} ({student.grade})
                          </p>
                          <p className="text-[#6b6b6b] mt-1">
                            {student.subject} - {student.topic}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
