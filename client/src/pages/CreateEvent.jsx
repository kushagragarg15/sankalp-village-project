import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Layout from '../components/Layout';
import Card, { CardBody, CardHeader, CardTitle } from '../components/Card';
import Input, { Textarea } from '../components/Input';
import Button from '../components/Button';

export default function CreateEvent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    startTime: '10:00',
    endTime: '14:00',
    description: ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const day = selectedDate.getDay();
      // 0 = Sunday, 6 = Saturday
      if (day !== 0 && day !== 6) {
        newErrors.date = 'Please select a weekend date (Saturday or Sunday)';
      }
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatTime = (time) => {
    // Convert 24h format to 12h format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const eventData = {
        ...formData,
        startTime: formatTime(formData.startTime),
        endTime: formatTime(formData.endTime)
      };

      const response = await api.post('/events', eventData);
      alert('Event created successfully!');
      navigate(`/events/${response.data.data._id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      alert(error.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/events')}
          className="mb-4"
        >
          ← Back to Events
        </Button>

        <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Create New Event</h1>

        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Event Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Weekend Learning Session - May 3"
                error={errors.title}
                required
              />

              <Input
                label="Date (Weekend Only)"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                error={errors.date}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Start Time"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  error={errors.startTime}
                  required
                />

                <Input
                  label="End Time"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  error={errors.endTime}
                  required
                />
              </div>

              <Textarea
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add details about subjects, activities, or special notes..."
                rows={4}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/events')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardBody>
            <h3 className="font-semibold text-zinc-900 mb-2">📋 Event Creation Tips</h3>
            <ul className="text-sm text-zinc-600 space-y-1">
              <li>• Events can only be created for weekends (Saturday or Sunday)</li>
              <li>• A unique QR code will be generated automatically</li>
              <li>• Volunteers will scan the QR code to check in</li>
              <li>• Teaching sessions can be logged during the event</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </Layout>
  );
}
