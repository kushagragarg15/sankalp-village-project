import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SessionsProvider } from './context/SessionsContext';
import LoadingState from './components/LoadingState';

// Login and the two screens a volunteer reaches first stay in the main bundle;
// everything else is split out so the first paint does not carry recharts or
// every admin screen along with it.
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VolunteerSessions from './pages/VolunteerSessions';
import AttendancePage from './pages/AttendancePage';

const Students = lazy(() => import('./pages/Students'));
const StudentProgress = lazy(() => import('./pages/StudentProgress'));
const MyAttendanceNew = lazy(() => import('./pages/MyAttendanceNew'));
const Volunteers = lazy(() => import('./pages/Volunteers'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AITeachingNotes = lazy(() => import('./pages/AITeachingNotes'));
const AskSankalp = lazy(() => import('./pages/AskSankalp'));
const SessionPrep = lazy(() => import('./pages/SessionPrep'));
const AdminSessions = lazy(() => import('./pages/AdminSessions'));
const AttendanceReport = lazy(() => import('./pages/AttendanceReport'));

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
  { path: '/my-attendance-new', element: <MyAttendanceNew /> },
  { path: '/students', element: <Students /> },
  { path: '/students/:id', element: <StudentProgress /> },
  { path: '/volunteers', element: <Volunteers />, adminOnly: true },
  { path: '/analytics', element: <Analytics /> },
  { path: '/ai-notes', element: <AITeachingNotes /> },
  { path: '/ask', element: <AskSankalp /> },
  { path: '/prep/:sessionId', element: <SessionPrep /> },
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
          <SessionsProvider>
            <Suspense
              fallback={
                <div className="min-h-screen bg-paper flex items-center justify-center">
                  <LoadingState label="Loading" />
                </div>
              }
            >
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
            </Suspense>
          </SessionsProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
