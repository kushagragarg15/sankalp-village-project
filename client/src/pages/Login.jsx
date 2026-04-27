import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import logoImage from '../assets/sankalp-logo.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Show content after logo animation completes
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1900);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);

    try {
      const result = await login(null, null, credentialResponse.credential);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Google sign-in failed');
      }
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    }
    
    setLoading(false);
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled or failed');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600&display=swap');
        
        /* Logo entrance animation */
        @keyframes logoReveal {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes glowPulse {
          0%, 100% {
            filter: drop-shadow(0 0 0px rgba(194, 120, 3, 0));
          }
          50% {
            filter: drop-shadow(0 0 18px rgba(194, 120, 3, 0.5));
          }
        }
        
        @keyframes slideToPosition {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-8px);
          }
        }
        
        @keyframes contentFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        
        .logo-animated {
          animation: 
            logoReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) 0ms forwards,
            glowPulse 600ms ease-in-out 800ms forwards,
            slideToPosition 500ms cubic-bezier(0.16, 1, 0.3, 1) 1400ms forwards;
        }
        
        .content-fade-in {
          animation: contentFadeIn 500ms ease-out 1400ms forwards;
          opacity: 0;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .logo-animated {
            animation: none;
            opacity: 1;
            transform: translateY(-8px);
          }
          .content-fade-in {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
      
      {/* Logo Splash Screen */}
      {!showContent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1a1714',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <img 
            src={logoImage}
            alt="Sankalp Logo"
            className="logo-animated"
            style={{
              height: '120px',
              width: '120px',
              objectFit: 'cover',
              borderRadius: '50%'
            }}
          />
        </div>
      )}
      
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        opacity: showContent ? 1 : 0,
        transition: 'opacity 300ms ease-out'
      }}>
        {/* Left Panel - Dark */}
        <div style={{
          flex: '1',
          backgroundColor: '#1a1714',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff'
        }}
        className="hidden md:flex"
        >
          <div>
            {/* Logo in final position */}
            <img 
              src={logoImage}
              alt="Sankalp Logo"
              style={{
                height: '80px',
                width: '80px',
                objectFit: 'cover',
                borderRadius: '50%',
                marginBottom: '24px'
              }}
            />
            
            <h1 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '48px',
              fontWeight: '600',
              marginBottom: '12px',
              letterSpacing: '-0.02em'
            }}>
              Sankalp
            </h1>
            <p style={{
              fontSize: '15px',
              color: '#a8a29e',
              marginBottom: '32px'
            }}>
              Rural Education Management System
            </p>
            
            <div style={{
              width: '60px',
              height: '1px',
              backgroundColor: '#44403c',
              marginBottom: '32px'
            }} />
            
            <div style={{
              fontSize: '15px',
              lineHeight: '1.8',
              color: '#d6d3d1'
            }}>
              <p style={{ marginBottom: '8px' }}>47 students tracked across 6 villages</p>
              <p style={{ marginBottom: '8px' }}>23 volunteer sessions this month</p>
              <p>Active since January 2024</p>
            </div>
          </div>
          
          <p style={{
            fontSize: '13px',
            color: '#57534e',
            lineHeight: '1.5'
          }}>
            Built to bring structure to volunteer-driven learning
          </p>
        </div>

        {/* Right Panel - White */}
        <div style={{
          flex: '1',
          backgroundColor: '#ffffff',
          padding: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {/* Mobile-only heading */}
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '32px',
              fontWeight: '600',
              color: '#111111',
              marginBottom: '32px',
              letterSpacing: '-0.02em'
            }}
            className="md:hidden"
            >
              Sankalp
            </h2>

            <h2 style={{
              fontSize: '28px',
              fontWeight: '600',
              color: '#111111',
              marginBottom: '8px'
            }}>
              sign in
            </h2>
            
            <p style={{
              fontSize: '14px',
              color: '#888888',
              marginBottom: '32px'
            }}>
              Enter your credentials to continue
            </p>

            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                marginBottom: '24px'
              }}>
                <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#444444',
                  letterSpacing: '0.02em',
                  marginBottom: '8px'
                }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 14px',
                    fontSize: '15px',
                    color: '#111111',
                    border: '1px solid #d4d4d4',
                    borderRadius: '6px',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                    fontFamily: 'Inter, sans-serif'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#111111'}
                  onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#444444',
                  letterSpacing: '0.02em',
                  marginBottom: '8px'
                }}>
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 14px',
                    fontSize: '15px',
                    color: '#111111',
                    border: '1px solid #d4d4d4',
                    borderRadius: '6px',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                    fontFamily: 'Inter, sans-serif'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#111111'}
                  onBlur={(e) => e.target.style.borderColor = '#d4d4d4'}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '44px',
                  backgroundColor: loading ? '#2a2a2a' : '#111111',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '500',
                  letterSpacing: '0.03em',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease',
                  fontFamily: 'Inter, sans-serif'
                }}
                onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#2a2a2a')}
                onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#111111')}
              >
                {loading ? 'signing in...' : 'sign in'}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#eeeeee' }} />
              <span style={{
                padding: '0 16px',
                fontSize: '12px',
                color: '#aaaaaa',
                textTransform: 'uppercase',
                letterSpacing: '0.08em'
              }}>
                or
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#eeeeee' }} />
            </div>

            {/* Google Sign-In Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '32px'
            }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
                width="400"
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hidden.md\\:flex {
            display: none !important;
          }
          .md\\:hidden {
            display: block !important;
          }
        }
        @media (min-width: 769px) {
          .md\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
    </GoogleOAuthProvider>
  );
}
