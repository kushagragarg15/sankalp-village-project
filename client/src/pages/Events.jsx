import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [filters]);

  const fetchEvents = async () => {
    try {
      let url = '/events?';
      if (filters.status) url += `status=${filters.status}`;
      
      const response = await api.get(url);
      setEvents(response.data.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    
    try {
      await api.delete(`/events/${eventId}`);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading events...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111111]">Events</h1>
          <button
            onClick={() => navigate('/events/create')}
            className="w-full sm:w-auto h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all"
          >
            + Create Event
          </button>
        </div>

        {/* Filters - Segmented Control */}
        <div className="mb-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="inline-flex border border-[#e4e4e4] rounded-md overflow-hidden min-w-max">
            <button
              onClick={() => setFilters({ ...filters, status: '' })}
              className={`h-9 sm:h-8 px-4 sm:px-3 text-sm sm:text-[13px] font-medium transition-colors ${
                filters.status === ''
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#6b6b6b] hover:bg-[#fafafa]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilters({ ...filters, status: 'upcoming' })}
              className={`h-9 sm:h-8 px-4 sm:px-3 text-sm sm:text-[13px] font-medium border-l border-[#e4e4e4] transition-colors ${
                filters.status === 'upcoming'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#6b6b6b] hover:bg-[#fafafa]'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilters({ ...filters, status: 'completed' })}
              className={`h-9 sm:h-8 px-4 sm:px-3 text-sm sm:text-[13px] font-medium border-l border-[#e4e4e4] transition-colors ${
                filters.status === 'completed'
                  ? 'bg-[#111111] text-white'
                  : 'bg-white text-[#6b6b6b] hover:bg-[#fafafa]'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="bg-white border border-[#e4e4e4] rounded-lg p-8 sm:p-12 text-center">
            <p className="text-[#6b6b6b] text-sm mb-4">No events found</p>
            <button
              onClick={() => navigate('/events/create')}
              className="h-11 sm:h-9 px-4 bg-[#111111] text-white text-sm font-medium rounded-md hover:bg-[#2a2a2a] active:scale-[0.98] transition-all"
            >
              Create Event
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {events.map((event) => (
              <div key={event._id} className="bg-white border border-[#e4e4e4] rounded-lg p-4 sm:p-5 hover:shadow-sm transition-shadow">
                <div className="flex flex-col gap-4">
                  {/* Event Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-sm sm:text-[15px] font-semibold text-[#111111]">
                        {event.title}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        event.status === 'completed'
                          ? 'bg-[#f0faf2] text-[#3a7d44] border border-[#c6e8cc]'
                          : event.status === 'upcoming'
                          ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
                          : 'bg-[#f7f7f6] text-[#6b6b6b] border border-[#e4e4e4]'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    
                    <div className="text-xs sm:text-[13px] text-[#6b6b6b] space-y-1">
                      <p>{formatDate(event.date)}</p>
                      <p>{event.startTime} - {event.endTime}</p>
                      <p>{event.volunteersPresent?.length || 0} volunteers checked in · {event.sessions?.length || 0} teaching sessions</p>
                    </div>

                    {event.description && (
                      <p className="text-xs sm:text-[13px] text-[#9a9a9a] italic mt-2 line-clamp-2">{event.description}</p>
                    )}
                  </div>

                  {/* Action Buttons - Stack on mobile, horizontal on desktop */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                    <button
                      onClick={() => navigate(`/events/${event._id}`)}
                      className="h-11 sm:h-9 px-4 bg-white border border-[#e4e4e4] text-[#111111] text-sm font-medium rounded-md hover:bg-[#fafafa] active:scale-[0.98] transition-all"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(`/events/${event._id}`)}
                      className="h-11 sm:h-9 px-4 bg-white border border-[#e4e4e4] text-[#111111] text-sm font-medium rounded-md hover:bg-[#fafafa] active:scale-[0.98] transition-all"
                    >
                      QR Code
                    </button>
                    <button
                      onClick={() => handleDelete(event._id)}
                      className="h-11 sm:h-9 px-4 text-sm text-[#9a9a9a] hover:text-[#111111] hover:bg-[#fafafa] border border-transparent hover:border-[#e4e4e4] rounded-md transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
