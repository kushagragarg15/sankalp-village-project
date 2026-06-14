import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import logoImage from '../assets/sankalp-logo.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');
    setLoading(true);

    if (!email || !password) {
      if (!email) setEmailError('Email is required');
      if (!password) setPasswordError('Password is required');
      setLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
      if (result.message.toLowerCase().includes('email')) {
        setEmailError(result.message);
      } else if (result.message.toLowerCase().includes('password')) {
        setPasswordError(result.message);
      }
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F4F0',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        padding: '24px'
      }}>
        {/* Centered Login Card */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          padding: '48px',
          borderRadius: '4px'
        }}>
          {/* Logo + Brand */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '32px'
          }}>
            <img 
              src={logoImage}
              alt="Sankalp Logo"
              style={{
                height: '56px',
                width: '56px',
                objectFit: 'cover',
                marginBottom: '16px'
              }}
            />
            
            <h1 style={{
              fontSize: '24px',
              fontWeight: '400',
              color: '#0A0A0A',
              marginBottom: '4px',
              letterSpacing: '-0.01em',
              textAlign: 'center'
            }}>
              Sankalp
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#888888',
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              Rural Education Management System
            </p>
          </div>

          <h2 style={{
            fontSize: '28px',
            fontWeight: '400',
            color: '#0A0A0A',
            marginBottom: '6px',
            letterSpacing: '-0.01em'
          }}>
            Welcome back
          </h2>
          
          <p style={{
            fontSize: '14px',
            color: '#888888',
            marginBottom: '32px',
            lineHeight: '1.6'
          }}>
            Enter your institutional email and password to continue
          </p>

          {error && !emailError && !passwordError && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #CC3333',
              borderRadius: '4px',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '12px', color: '#CC3333', lineHeight: '1.4' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#3D3D3D',
                marginBottom: '6px'
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                  setError('');
                }}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  fontSize: '14px',
                  color: '#0A0A0A',
                  border: emailError ? '1px solid #CC3333' : '1px solid #D0CFCA',
                  borderRadius: '4px',
                  outline: 'none',
                  transition: 'border-color 120ms ease-in-out',
                  fontFamily: 'Inter, sans-serif',
                  backgroundColor: '#FFFFFF'
                }}
                onFocus={(e) => {
                  if (!emailError) {
                    e.target.style.border = '1.5px solid #1A1A1A';
                  }
                }}
                onBlur={(e) => {
                  if (!emailError) {
                    e.target.style.border = '1px solid #D0CFCA';
                  }
                }}
                onMouseEnter={(e) => {
                  if (!emailError && document.activeElement !== e.target) {
                    e.target.style.borderColor = '#999999';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!emailError && document.activeElement !== e.target) {
                    e.target.style.borderColor = '#D0CFCA';
                  }
                }}
              />
              {emailError && (
                <p style={{ fontSize: '12px', color: '#CC3333', marginTop: '4px' }}>{emailError}</p>
              )}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#3D3D3D',
                marginBottom: '6px'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                    setError('');
                  }}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 40px 0 14px',
                    fontSize: '14px',
                    color: '#0A0A0A',
                    border: passwordError ? '1px solid #CC3333' : '1px solid #D0CFCA',
                    borderRadius: '4px',
                    outline: 'none',
                    transition: 'border-color 120ms ease-in-out',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: '#FFFFFF'
                  }}
                  onFocus={(e) => {
                    if (!passwordError) {
                      e.target.style.border = '1.5px solid #1A1A1A';
                    }
                  }}
                  onBlur={(e) => {
                    if (!passwordError) {
                      e.target.style.border = '1px solid #D0CFCA';
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!passwordError && document.activeElement !== e.target) {
                      e.target.style.borderColor = '#999999';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!passwordError && document.activeElement !== e.target) {
                      e.target.style.borderColor = '#D0CFCA';
                    }
                  }}
                />
                {/* Eye Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888888',
                    transition: 'color 120ms ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3D3D3D'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#888888'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
              {passwordError && (
                <p style={{ fontSize: '12px', color: '#CC3333', marginTop: '4px' }}>{passwordError}</p>
              )}
              {/* Forgot Password */}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  setError('Password reset feature coming soon. Please contact admin.');
                }}
                style={{
                  fontSize: '13px',
                  color: '#3D3D3D',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginTop: '8px',
                  transition: 'color 120ms ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.target.style.textDecoration = 'none';
                }}
              >
                Forgot password?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '44px',
                backgroundColor: loading ? '#888888' : '#1A1A1A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: '500',
                letterSpacing: '0.02em',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 140ms ease',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#333333';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#1A1A1A';
                }
              }}
              onMouseDown={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#000000';
                }
              }}
              onMouseUp={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#333333';
                }
              }}
            >
              {loading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
                  <circle cx="12" cy="12" r="10" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                </svg>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E0E0E0' }} />
            <span style={{
              padding: '0 12px',
              fontSize: '13px',
              color: '#AAAAAA',
              backgroundColor: '#FFFFFF'
            }}>
              or
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E0E0E0' }} />
          </div>

          {/* Google Sign-In Button */}
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => {
                document.querySelector('[aria-labelledby]')?.click();
              }}
              type="button"
              style={{
                width: '100%',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D0CFCA',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '400',
                color: '#1A1A1A',
                cursor: 'pointer',
                transition: 'all 140ms ease',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#F7F6F2';
                e.target.style.borderColor = '#999999';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#FFFFFF';
                e.target.style.borderColor = '#D0CFCA';
              }}
            >
              {/* Monochrome Google Logo */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#888888"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#888888"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#888888"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#888888"/>
              </svg>
              Continue with Google
            </button>
            {/* Hidden Google OAuth */}
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
            fontSize: '13px',
            color: '#3D3D3D'
          }}>
            Need access?{' '}
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                setError('Please contact your organization admin to request access.');
              }}
              style={{
                color: '#8B6914',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'color 120ms ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#6B5010';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#8B6914';
              }}
            >
              Request an account
            </a>
          </p>

          {/* Bottom Tagline */}
          <p style={{
            fontSize: '12px',
            color: '#888888',
            textAlign: 'center',
            marginTop: '32px',
            fontStyle: 'italic',
            lineHeight: '1.5'
          }}>
            Empowering rural communities through structured, volunteer-driven education
          </p>
        </div>
      </div>
    </>
    </GoogleOAuthProvider>
  );
}
