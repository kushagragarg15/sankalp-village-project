import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .sidebar-container {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          .sidebar-container.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 40;
          }
          .sidebar-overlay.open {
            display: block;
          }
          .main-content {
            margin-left: 0 !important;
            padding-top: 60px !important;
          }
          .main-content-inner {
            padding: 16px !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-header {
            display: none !important;
          }
          .sidebar-overlay {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f7f7f6',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        {/* Mobile Header */}
        <div
          className="mobile-header"
          style={{
            display: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e4e4e4',
            alignItems: 'center',
            padding: '0 16px',
            zIndex: 30
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111111"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span style={{
            marginLeft: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#111111'
          }}>
            Sankalp
          </span>
        </div>

        {/* Sidebar Overlay (Mobile) */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={handleCloseSidebar}
        />

        {/* Sidebar */}
        <div className={`sidebar-container ${sidebarOpen ? 'open' : ''}`} style={{ position: 'fixed', zIndex: 60 }}>
          <Sidebar onNavigate={handleCloseSidebar} />
        </div>

        {/* Main Content */}
        <div className="main-content" style={{ marginLeft: '220px' }}>
          <main className="main-content-inner" style={{ padding: '40px' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
