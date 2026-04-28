import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
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

export default api;
