import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-button {
            display: block !important;
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
          }
          .main-content-inner {
            padding: 20px !important;
          }
        }
        @media (min-width: 769px) {
          .mobile-menu-button {
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
        {/* Mobile Menu Button */}
        <button
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 50,
            width: '40px',
            height: '40px',
            backgroundColor: '#111111',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'none'
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{ margin: 'auto', display: 'block' }}
          >
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Sidebar Overlay (Mobile) */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div className={`sidebar-container ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
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
