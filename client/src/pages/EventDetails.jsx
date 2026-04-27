import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/events/${id}`);
      setEvent(response.data.data);
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCheckInTime = (time) => {
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const variants = {
      upcoming: 'info',
      ongoing: 'warning',
      completed: 'success',
      cancelled: 'danger'
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const handleCopyQRCode = () => {
    navigator.clipboard.writeText(event.qrCode);
    alert('QR code copied to clipboard!');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-zinc-500">Loading event details...</p>
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-zinc-500">Event not found</p>
          <Button onClick={() => navigate('/events')} className="mt-4">
            Back to Events
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/events')}
          className="mb-4"
        >
          ← Back to Events
        </Button>

        {/* Event Header */}
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-zinc-900">{event.title}</h1>
                  {getStatusBadge(event.status)}
                </div>
                <div className="text-zinc-600 space-y-1">
                  <p>📅 {formatDate(event.date)}</p>
                  <p>🕐 {event.startTime} - {event.endTime}</p>
                  {event.description && <p className="mt-2">{event.description}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary">
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Check-In QR Code</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col items-center">
                <div className="bg-white p-6 rounded-lg border-2 border-zinc-200">
                  <QRCodeSVG
                    value={event.qrCode}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="mt-4 text-sm font-mono text-zinc-600 bg-zinc-100 px-4 py-2 rounded">
                  {event.qrCode}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyQRCode}
                  className="mt-3"
                >
                  Copy Code
                </Button>
                <p className="text-xs text-zinc-500 mt-3 text-center">
                  Volunteers scan this code to check in
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Volunteers Present */}
          <Card>
            <CardHeader>
              <CardTitle>Volunteers Present ({event.volunteersPresent?.length || 0})</CardTitle>
            </CardHeader>
            <CardBody>
              {event.volunteersPresent && event.volunteersPresent.length > 0 ? (
                <div className="space-y-3">
                  {event.volunteersPresent.map((vp, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-zinc-50 rounded-md"
                    >
                      <div>
                        <p className="font-medium text-zinc-900">
                          {vp.volunteer?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-zinc-600">
                          {vp.volunteer?.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-600">
                          {formatCheckInTime(vp.checkInTime)}
                        </p>
                        <Badge variant={vp.checkInMethod === 'qr' ? 'success' : 'default'}>
                          {vp.checkInMethod === 'qr' ? 'QR' : 'Manual'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">
                  No volunteers checked in yet
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Teaching Sessions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Teaching Sessions ({event.sessions?.length || 0})</CardTitle>
          </CardHeader>
          <CardBody>
            {event.sessions && event.sessions.length > 0 ? (
              <div className="space-y-4">
                {event.sessions.map((session, index) => (
                  <div
                    key={index}
                    className="p-4 border border-zinc-200 rounded-md"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="primary">{session.subject}</Badge>
                          {session.startTime && session.endTime && (
                            <span className="text-sm text-zinc-600">
                              {session.startTime} - {session.endTime}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-zinc-900">{session.topicCovered}</h4>
                        <p className="text-sm text-zinc-600">
                          By {session.volunteer?.name || 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-600">
                          {session.studentsPresent?.length || 0} students
                        </p>
                      </div>
                    </div>
                    {session.notes && (
                      <p className="text-sm text-zinc-600 mt-2 p-3 bg-zinc-50 rounded">
                        {session.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">
                No teaching sessions logged yet
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
