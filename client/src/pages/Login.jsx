import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import logoImage from '../assets/sankalp-logo.jpg';
import studentIllustration from '../assets/student-illustration.png';

const QUOTES = [
  {
    text: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  },
  {
    text: "The function of education is to teach one to think intensively and to think critically.",
    author: "Martin Luther King Jr."
  },
  {
    text: "Education is not preparation for life; education is life itself.",
    author: "John Dewey"
  },
  {
    text: "The roots of education are bitter, but the fruit is sweet.",
    author: "Aristotle"
  }
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [detectedRole, setDetectedRole] = useState(null); // 'volunteer' or 'admin'
  const { login } = useAuth();
  const navigate = useNavigate();

  // Detect role from email domain
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setDetectedRole(null);
      return;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      setDetectedRole(null);
      return;
    }

    // Admin domains
    const adminDomains = ['admin.sankalp.org', 'sankalp.org'];
    // Common volunteer domains (educational institutions, etc.)
    const volunteerDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

    if (adminDomains.some(d => domain === d || domain.endsWith(d))) {
      setDetectedRole('admin');
    } else if (volunteerDomains.some(d => domain === d || domain.endsWith(d)) || domain.includes('edu')) {
      setDetectedRole('volunteer');
    } else {
      // Default to volunteer for unknown domains
      setDetectedRole('volunteer');
    }
  }, [email]);

  useEffect(() => {
    // Show content after logo animation completes
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1900);
    return () => clearTimeout(timer);
  }, []);

  // Rotate quotes every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
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
        
        @keyframes quoteFade {
          0%, 100% {
            opacity: 0;
            transform: translateY(10px);
          }
          10%, 90% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
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
        
        .quote-animated {
          animation: quoteFade 6s ease-in-out infinite;
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
          .quote-animated {
            animation: none;
            opacity: 1;
            transform: translateY(0);
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
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        opacity: showContent ? 1 : 0,
        transition: 'opacity 300ms ease-out'
      }}>
        {/* Left Panel - Dark */}
        <div style={{
          flex: '1',
          backgroundColor: '#1a1714',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff',
          overflow: 'hidden'
        }}
        className="hidden md:flex"
        >
          <div>
            {/* Logo in final position */}
            <img 
              src={logoImage}
              alt="Sankalp Logo"
              style={{
                height: '64px',
                width: '64px',
                objectFit: 'cover',
                borderRadius: '50%',
                marginBottom: '20px'
              }}
            />
            
            <h1 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '42px',
              fontWeight: '600',
              marginBottom: '8px',
              letterSpacing: '-0.02em'
            }}>
              Sankalp
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#a8a29e',
              marginBottom: '28px'
            }}>
              Rural Education Management System
            </p>
            
            <div style={{
              width: '60px',
              height: '1px',
              backgroundColor: '#44403c',
              marginBottom: '32px'
            }} />
            
            {/* Rotating Quote */}
            <div style={{ minHeight: '140px', position: 'relative' }}>
              <div 
                key={currentQuoteIndex}
                className="quote-animated"
                style={{
                  position: 'absolute',
                  width: '100%'
                }}
              >
                <div style={{
                  fontSize: '18px',
                  lineHeight: '1.6',
                  color: '#e7e5e4',
                  fontStyle: 'italic',
                  marginBottom: '12px',
                  fontFamily: 'Playfair Display, Georgia, serif'
                }}>
                  "{QUOTES[currentQuoteIndex].text}"
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#78716c'
                }}>
                  — {QUOTES[currentQuoteIndex].author}
                </div>
              </div>
            </div>
          </div>
          
          {/* Student Illustration */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '20px 0'
          }}>
            <img 
              src={studentIllustration}
              alt="Student Learning"
              style={{
                maxWidth: '240px',
                width: '100%',
                height: 'auto',
                opacity: 0.85,
                filter: 'brightness(0.95)'
              }}
            />
          </div>
          
          <p style={{
            fontSize: '13px',
            color: '#57534e',
            lineHeight: '1.5',
            fontStyle: 'italic'
          }}>
            Empowering rural communities through structured, volunteer-driven education
          </p>
        </div>

        {/* Right Panel - White */}
        <div style={{
          flex: '1',
          backgroundColor: '#ffffff',
          padding: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto'
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
              fontSize: '32px',
              fontWeight: '600',
              color: '#111111',
              marginBottom: '8px',
              transition: 'color 300ms ease'
            }}>
              Welcome back
            </h2>
            
            <p style={{
              fontSize: '15px',
              color: '#666666',
              marginBottom: '24px'
            }}>
              Enter your institutional email to continue
            </p>

            {/* Role Detection Badge */}
            {detectedRole && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                marginBottom: '20px',
                backgroundColor: detectedRole === 'admin' ? '#dbeafe' : '#dcfce7',
                color: detectedRole === 'admin' ? '#1e40af' : '#15803d',
                transition: 'all 300ms ease',
                animation: 'slideIn 300ms ease-out'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: detectedRole === 'admin' ? '#3b82f6' : '#22c55e',
                  marginRight: '8px'
                }} />
                Signing in as {detectedRole === 'admin' ? 'Admin' : 'Volunteer'}
              </div>
            )}

            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', color: '#dc2626' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#374151',
                  letterSpacing: '0.01em',
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
                    height: '46px',
                    padding: '0 14px',
                    fontSize: '15px',
                    color: '#111111',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'all 200ms ease',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: '#ffffff'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = detectedRole === 'admin' ? '#3b82f6' : detectedRole === 'volunteer' ? '#22c55e' : '#111111';
                    e.target.style.boxShadow = detectedRole === 'admin' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : detectedRole === 'volunteer' ? '0 0 0 3px rgba(34, 197, 94, 0.1)' : '0 0 0 3px rgba(0, 0, 0, 0.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#374151',
                    letterSpacing: '0.01em'
                  }}>
                    PASSWORD
                  </label>
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      setError('Password reset feature coming soon. Please contact admin.');
                    }}
                    style={{
                      fontSize: '13px',
                      color: '#d97706',
                      textDecoration: 'none',
                      fontWeight: '500',
                      transition: 'color 150ms ease'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#b45309'}
                    onMouseLeave={(e) => e.target.style.color = '#d97706'}
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 14px',
                    fontSize: '15px',
                    color: '#111111',
                    border: '1.5px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'all 200ms ease',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: '#ffffff'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = detectedRole === 'admin' ? '#3b82f6' : detectedRole === 'volunteer' ? '#22c55e' : '#111111';
                    e.target.style.boxShadow = detectedRole === 'admin' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : detectedRole === 'volunteer' ? '0 0 0 3px rgba(34, 197, 94, 0.1)' : '0 0 0 3px rgba(0, 0, 0, 0.05)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '46px',
                  marginTop: '16px',
                  backgroundColor: loading ? '#9ca3af' : (detectedRole === 'admin' ? '#3b82f6' : detectedRole === 'volunteer' ? '#22c55e' : '#111111'),
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '600',
                  letterSpacing: '0.01em',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms ease',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: loading ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = detectedRole === 'admin' ? '#2563eb' : detectedRole === 'volunteer' ? '#16a34a' : '#000000';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.backgroundColor = detectedRole === 'admin' ? '#3b82f6' : detectedRole === 'volunteer' ? '#22c55e' : '#111111';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '24px 0'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
              <span style={{
                padding: '0 12px',
                fontSize: '13px',
                color: '#9ca3af',
                fontWeight: '500'
              }}>
                OR
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
            </div>

            {/* Google Sign-In Button */}
            <div style={{
              marginBottom: '24px'
            }}>
              <button
                onClick={() => {
                  // Trigger Google OAuth
                  document.querySelector('[aria-labelledby]')?.click();
                }}
                style={{
                  width: '100%',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  fontFamily: 'Inter, sans-serif'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f9fafb';
                  e.target.style.borderColor = '#9ca3af';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#ffffff';
                  e.target.style.borderColor = '#d1d5db';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              {/* Hidden Google button for actual OAuth */}
              <div style={{ display: 'none' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  theme="outline"
                  size="large"
                />
              </div>
            </div>

            {/* Request Access Link */}
            <p style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              Need access?{' '}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  setError('Please contact your organization admin to request access.');
                }}
                style={{
                  color: '#d97706',
                  textDecoration: 'none',
                  fontWeight: '500',
                  transition: 'color 150ms ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#b45309'}
                onMouseLeave={(e) => e.target.style.color = '#d97706'}
              >
                Request an account
              </a>
            </p>
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
