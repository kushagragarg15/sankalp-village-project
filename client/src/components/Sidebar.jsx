import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, GraduationCap, BarChart2, FileText, ClipboardCheck } from 'lucide-react';
import logoImage from '../assets/sankalp-logo.jpg';

export default function Sidebar({ onNavigate }) {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const adminLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin-sessions', label: 'Manage Sessions', icon: ClipboardCheck },
    { path: '/volunteers', label: 'Volunteers', icon: Users },
    { path: '/students', label: 'Students', icon: GraduationCap },
    { path: '/analytics', label: 'Analytics', icon: BarChart2 },
    { path: '/ai-notes', label: 'AI Notes', icon: FileText }
  ];

  const volunteerLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/volunteer-sessions', label: 'Attendance Sessions', icon: ClipboardCheck },
    { path: '/students', label: 'Students', icon: GraduationCap },
    { path: '/analytics', label: 'Analytics', icon: BarChart2 },
    { path: '/ai-notes', label: 'AI Notes', icon: FileText }
  ];

  const links = isAdmin ? adminLinks : volunteerLinks;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        .mobile-close-btn {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        
        .mobile-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          border-radius: 4px;
        }
        
        .mobile-close-btn:active {
          background-color: rgba(255, 255, 255, 0.2) !important;
        }
        
        @media (min-width: 769px) {
          .mobile-close-btn {
            display: none !important;
          }
        }
      `}</style>
      
      <div style={{
        width: '220px',
        backgroundColor: '#111111',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        {/* Logo */}
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '20px 16px 16px 16px',
          borderBottom: '1px solid #1f1f1f'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src={logoImage}
              alt="Sankalp Logo"
              style={{
                height: '28px',
                width: 'auto',
                objectFit: 'contain'
              }}
            />
            <div>
              <h1 style={{ 
                fontSize: '15px', 
                fontWeight: '600', 
                color: '#ffffff',
                marginBottom: '2px',
                lineHeight: '1'
              }}>
                Sankalp
              </h1>
              <p style={{ 
                fontSize: '11px', 
                color: '#666666',
                lineHeight: '1'
              }}>
                Rural Education
              </p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          <button
            onClick={onNavigate}
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              lineHeight: '1',
              minWidth: '40px',
              minHeight: '40px',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none'
            }}
            className="mobile-close-btn"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={onNavigate}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 20px',
                  fontSize: '14px',
                  color: active ? '#ffffff' : '#777777',
                  textDecoration: 'none',
                  backgroundColor: active ? '#1f1f1f' : 'transparent',
                  borderLeft: active ? '2px solid #ffffff' : '2px solid transparent',
                  transition: 'all 120ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                    e.currentTarget.style.color = '#cccccc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#777777';
                  }
                }}
              >
                <Icon size={16} style={{ marginRight: '12px' }} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div style={{ 
          padding: '20px', 
          borderTop: '1px solid #2a2a2a'
        }}>
          <p style={{ 
            fontSize: '13px', 
            fontWeight: '500', 
            color: '#ffffff',
            marginBottom: '2px'
          }}>
            {user?.name}
          </p>
          <p style={{ 
            fontSize: '11px', 
            color: '#666666',
            marginBottom: '12px'
          }}>
            {user?.email}
          </p>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '13px',
              color: '#666666',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
