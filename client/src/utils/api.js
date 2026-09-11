import axios from 'axios';

// With no VITE_API_URL we stay same-origin and let the Vite dev proxy (and any
// production rewrite) forward /api — that avoids the CORS preflight entirely.
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if we're not already on the login page
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Attendance Session API
export const attendanceSessionAPI = {
  getAll: () => api.get('/attendance-sessions'),
  getOne: (id) => api.get(`/attendance-sessions/${id}`),
  create: (data) => api.post('/attendance-sessions', data),
  generateCode: (id) => api.post(`/attendance-sessions/${id}/generate-code`),
  delete: (id) => api.delete(`/attendance-sessions/${id}`)
};

// Registration API
export const registrationAPI = {
  register: (sessionId) => api.post('/registrations/register', { sessionId }),
  getMyRegistrations: () => api.get('/registrations/my-registrations'),
  getSessionRegistrations: (sessionId) => api.get(`/registrations/session/${sessionId}`),
  unregister: (id) => api.delete(`/registrations/${id}`)
};

// Teaching Log API
export const teachingLogAPI = {
  submit: (data) => api.post('/teaching-logs/submit', data),
  getMyLogs: () => api.get('/teaching-logs/my-logs'),
  getSessionLogs: (sessionId) => api.get(`/teaching-logs/session/${sessionId}`),
  getAll: () => api.get('/teaching-logs')
};

// Students API (if not already exists)
export const getStudents = () => api.get('/students');

// Aggregated insights — one call, computed server-side, readable by any member.
export const analyticsAPI = {
  overview: () => api.get('/analytics/overview')
};

// User administration (admin only)
export const userAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`)
};

// AI: the RAG lesson planner and the tool-using agent
export const aiAPI = {
  generateNotes: (data) => api.post('/ai/generate-notes', data),
  // messages: [{ role: 'user' | 'assistant', content }], last one is the new question
  ask: (messages) => api.post('/ai/ask', { messages })
};

// Volunteer Attendance API
export const volunteerAttendanceAPI = {
  getAll: () => api.get('/volunteer-attendance'),
  getMyAttendance: () => api.get('/volunteer-attendance/my-attendance'),
  getVolunteerAttendance: (volunteerId) => api.get(`/volunteer-attendance/${volunteerId}`)
};

export default api;
