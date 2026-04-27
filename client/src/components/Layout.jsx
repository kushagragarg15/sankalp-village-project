import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f7f7f6',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <Sidebar />
      <div style={{ marginLeft: '220px' }}>
        <main style={{ padding: '40px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
