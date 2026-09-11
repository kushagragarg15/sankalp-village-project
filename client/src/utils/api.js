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
  ask: (messages) => api.post('/ai/ask', { messages }),

  /**
   * Same as ask(), but streamed as Server-Sent Events so the page can show
   * tool steps and the answer as they happen. Axios cannot read a stream, so
   * this uses fetch with the same base URL, token and cookie the instance uses.
   * Calls onEvent for every event; resolves with the 'done' payload; rejects
   * on transport failure or an 'error' event.
   */
  askStream: async (messages, onEvent, { signal } = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${api.defaults.baseURL}/ai/ask/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ messages }),
      signal
    });

    if (!response.ok) {
      // Guardrails and validation answer with JSON before any stream starts.
      let message = 'That did not go through. Try again in a moment.';
      try { message = (await response.json()).message || message; } catch { /* keep default */ }
      const err = new Error(message);
      err.status = response.status;
      err.retryAfter = Number(response.headers.get('Retry-After')) || null;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = null;

    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; a chunk may end mid-event.
      let split;
      while ((split = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, split).trim();
        buffer = buffer.slice(split + 2);
        if (!raw.startsWith('data:')) continue;
        const event = JSON.parse(raw.slice(5));
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'done') done = event;
        onEvent(event);
      }
    }
    if (!done) throw new Error('The connection closed before the answer finished.');
    return done;
  }
};

// Coordinator observability over the AI features
export const aiAdminAPI = {
  activity: () => api.get('/ai/admin/activity'),
  run: (id) => api.get(`/ai/admin/runs/${id}`)
};

// Session prep: the workflow drafts a plan, the volunteer reviews it.
export const prepAPI = {
  getForSession: (sessionId) => api.get(`/prep/sessions/${sessionId}`),
  prepare: (sessionId, force = false) => api.post(`/prep/sessions/${sessionId}`, { force }),
  mine: () => api.get('/prep/mine'),
  edit: (id, focusGroups) => api.patch(`/prep/${id}`, { focusGroups }),
  approve: (id, note = '') => api.post(`/prep/${id}/approve`, { note }),
  reject: (id, reason) => api.post(`/prep/${id}/reject`, { reason }),
  // Coordinator
  prepareAll: (sessionId) => api.post(`/prep/sessions/${sessionId}/all`),
  allForSession: (sessionId) => api.get(`/prep/sessions/${sessionId}/all`)
};

// Volunteer Attendance API
export const volunteerAttendanceAPI = {
  getAll: () => api.get('/volunteer-attendance'),
  getMyAttendance: () => api.get('/volunteer-attendance/my-attendance'),
  getVolunteerAttendance: (volunteerId) => api.get(`/volunteer-attendance/${volunteerId}`)
};

export default api;
