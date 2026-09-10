import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoadingState from './components/LoadingState';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProgress from './pages/StudentProgress';
import CheckIn from './pages/CheckIn';
import LogSession from './pages/LogSession';
import MyAttendance from './pages/MyAttendance';
import MyAttendanceNew from './pages/MyAttendanceNew';
import Volunteers from './pages/Volunteers';
import Analytics from './pages/Analytics';
import AITeachingNotes from './pages/AITeachingNotes';
import AdminSessions from './pages/AdminSessions';
import VolunteerSessions from './pages/VolunteerSessions';
import AttendancePage from './pages/AttendancePage';
import AttendanceReport from './pages/AttendanceReport';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <LoadingState label="Signing you in" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return children;
}

const routes = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/checkin', element: <CheckIn /> },
  { path: '/log-session', element: <LogSession /> },
  { path: '/my-attendance', element: <MyAttendance /> },
  { path: '/my-attendance-new', element: <MyAttendanceNew /> },
  { path: '/students', element: <Students /> },
  { path: '/students/:id', element: <StudentProgress /> },
  { path: '/volunteers', element: <Volunteers />, adminOnly: true },
  { path: '/analytics', element: <Analytics /> },
  { path: '/ai-notes', element: <AITeachingNotes /> },
  { path: '/admin-sessions', element: <AdminSessions />, adminOnly: true },
  { path: '/volunteer-sessions', element: <VolunteerSessions /> },
  { path: '/attendance/:sessionId', element: <AttendancePage /> },
  { path: '/attendance-report', element: <AttendanceReport />, adminOnly: true },
];

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {routes.map(({ path, element, adminOnly }) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute adminOnly={adminOnly}>{element}</ProtectedRoute>
                }
              />
            ))}

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
