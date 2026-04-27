import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';

export default function CheckIn() {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  useEffect(() => {
    fetchUpcomingEvents();
    
    // Cleanup scanner on unmount
    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(err => {
          console.error('Error clearing scanner:', err);
        });
      }
    };
  }, []);

  const fetchUpcomingEvents = async () => {
    try {
      const response = await api.get('/events/upcoming');
      setUpcomingEvents(response.data.data);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const startScanner = () => {
    if (scannerActive) {
      stopScanner();
      return;
    }

    setScannerActive(true);
    setMessage({ type: '', text: '' });

    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true
      },
      false
    );

    scanner.render(onScanSuccess, onScanError);
    html5QrcodeScannerRef.current = scanner;
  };

  const stopScanner = () => {
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.clear().then(() => {
        setScannerActive(false);
        html5QrcodeScannerRef.current = null;
      }).catch(err => {
        console.error('Error stopping scanner:', err);
        setScannerActive(false);
      });
    }
  };

  const onScanSuccess = (decodedText) => {
    // Stop scanner after successful scan
    stopScanner();
    
    // Set the scanned code
    setQrCode(decodedText.toUpperCase());
    
    // Auto check-in
    handleCheckInWithCode(decodedText);
  };

  const onScanError = (errorMessage) => {
    // Ignore scan errors (they happen frequently while scanning)
    // console.log('Scan error:', errorMessage);
  };

  const handleCheckInWithCode = async (code) => {
    if (!code.trim()) {
      setMessage({ type: 'error', text: 'Please enter a QR code' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/events/checkin', { qrCode: code.trim() });
      setMessage({ type: 'success', text: response.data.message });
      setQrCode('');
      
      // Redirect to event details after 2 seconds
      setTimeout(() => {
        const eventId = response.data.data._id;
        navigate(`/events/${eventId}`);
      }, 2000);
    } catch (error) {
      console.error('Error checking in:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Check-in failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    handleCheckInWithCode(qrCode);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 mb-4 sm:mb-6">Check In to Event</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Check-In Form */}
          <Card>
            <CardHeader>
              <CardTitle>Scan or Enter QR Code</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {/* QR Scanner */}
                <div>
                  <Button
                    type="button"
                    onClick={startScanner}
                    variant={scannerActive ? 'danger' : 'primary'}
                    className="w-full mb-4"
                  >
                    {scannerActive ? '🛑 Stop Camera' : '📷 Scan QR Code'}
                  </Button>

                  {scannerActive && (
                    <div className="border-2 border-indigo-300 rounded-lg overflow-hidden bg-black">
                      <div id="qr-reader" ref={scannerRef}></div>
                    </div>
                  )}

                  {!scannerActive && (
                    <div className="border-2 border-dashed border-zinc-300 rounded-lg p-6 sm:p-8 text-center bg-zinc-50">
                      <div className="text-4xl mb-2">📷</div>
                      <p className="text-sm text-zinc-600">
                        Click the button above to start scanning
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Or enter the code manually below
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-zinc-500">Or enter manually</span>
                  </div>
                </div>

                <form onSubmit={handleCheckIn} className="space-y-4">
                  <Input
                    label="Event Code"
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                    placeholder="EVENT-20260503-A7B9C2"
                    className="font-mono"
                  />

                  {message.text && (
                    <div
                      className={`p-3 rounded-md ${
                        message.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || scannerActive}>
                    {loading ? 'Checking In...' : 'Check In'}
                  </Button>
                </form>
              </div>
            </CardBody>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardBody>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event._id}
                      className="p-3 sm:p-4 border border-zinc-200 rounded-md hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-zinc-900 mb-1 truncate">
                            {event.title}
                          </h4>
                          <p className="text-sm text-zinc-600">
                            📅 {formatDate(event.date)}
                          </p>
                          <p className="text-sm text-zinc-600">
                            🕐 {event.startTime} - {event.endTime}
                          </p>
                          <p className="text-sm text-zinc-600 mt-1">
                            👥 {event.volunteersPresent?.length || 0} checked in
                          </p>
                        </div>
                        <Badge variant="info">{event.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">
                  No upcoming events scheduled
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-4 sm:mt-6">
          <CardBody>
            <h3 className="font-semibold text-zinc-900 mb-2">📋 How to Check In</h3>
            <ul className="text-sm text-zinc-600 space-y-1">
              <li>1. Click "Scan QR Code" to open your camera</li>
              <li>2. Point your camera at the QR code displayed by the admin</li>
              <li>3. The system will automatically check you in when the code is detected</li>
              <li>4. Alternatively, you can enter the event code manually</li>
              <li>5. After check-in, you can log teaching sessions for this event</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
