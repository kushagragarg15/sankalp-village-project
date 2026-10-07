import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleOAuthProvider, GoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import PhotoWall from '../components/PhotoWall';

function EyeIcon({ crossed }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {crossed ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <path d="M1 1l22 22" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function SpinnerIcon({ className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function DemoButton({ label, pending, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={pending}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-paper/15 text-[13px] font-medium text-paper transition-colors duration-150 hover:border-paper/40 hover:bg-paper/5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <SpinnerIcon className="text-paper/70" />}
      {pending ? 'Opening demo' : label}
    </button>
  );
}

/**
 * Google's own button, at Google's own hand — GIS draws it inside an iframe
 * it controls, so there is no way to restyle it pixel-for-pixel without
 * abandoning the ID-token flow the backend verifies. What we *can* own: an
 * exact-width container (no more invalid "100%" prop), a skeleton so the page
 * doesn't jump when the script lands, and an honest fallback if it never
 * loads at all.
 */
function GoogleSignInButton({ onSuccess, onError, disabled, scriptFailed }) {
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (scriptFailed) return null;

  const ready = scriptLoadedSuccessfully && width > 0;

  return (
    <div
      ref={wrapRef}
      className={`relative h-10 w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-md border border-paper/15 transition-opacity duration-300 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div
        className={`absolute inset-0 flex items-center overflow-hidden rounded-md transition-opacity duration-300 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {ready && (
          <GoogleLogin
            onSuccess={onSuccess}
            onError={onError}
            theme="filled_black"
            size="large"
            shape="rectangular"
            text="continue_with"
            logo_alignment="left"
            width={String(width)}
          />
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);
  const [demoRole, setDemoRole] = useState(null);
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const busy = loading || demoRole !== null;

  const handleDemo = async (role) => {
    setError('');
    setDemoRole(role);
    const result = await demoLogin(role);
    setDemoRole(null);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Enter both your email and password to sign in.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const result = await login(null, null, credentialResponse.credential);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.message || 'Google could not sign you in. Try your email and password.');
      }
    } catch {
      setError('Google could not sign you in. Try your email and password.');
    }
    setLoading(false);
  };

  const handleGoogleError = () => {
    setError('Google sign-in was cancelled. Try again or use your password.');
  };

  const fieldClass = `h-11 w-full rounded-md border bg-board-700 px-3.5 text-[15px] text-paper placeholder:text-paper/40 outline-none transition-colors duration-150 focus:ring-1 disabled:opacity-60 ${
    error
      ? 'border-[#E58A80] focus:border-[#E58A80] focus:ring-[#E58A80]'
      : 'border-paper/10 hover:border-paper/25 focus:border-gold-bright focus:ring-gold-bright'
  }`;

  return (
    <GoogleOAuthProvider clientId={googleClientId} onScriptLoadError={() => setGoogleScriptFailed(true)}>
      <div className="relative min-h-screen bg-board text-paper">
        <PhotoWall />
        {/* One flat dim, nothing graded: the photos stay sharp, the type stays readable. */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-board/80" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col justify-center gap-10 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12 xl:px-16">
          <div>
            <h1
              className="select-none text-[clamp(4.25rem,15vw,7rem)] leading-[0.9] tracking-[-0.04em] text-paper lg:text-[clamp(7rem,12.5vw,13rem)]"
              style={{ fontStretch: '125%', fontWeight: 800 }}
            >
              Saakshi
            </h1>
            <p className="mt-4 text-[clamp(1.05rem,1.8vw,1.5rem)] font-medium leading-snug text-paper/85 lg:mt-6">
              Every hour of good, on the record.
            </p>
          </div>

          <main className="w-full max-w-[22rem] shrink-0 rounded-xl border border-paper/10 bg-board p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-3" noValidate aria-label="Sign in">
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                disabled={busy}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Email"
                className={fieldClass}
              />

              <label htmlFor="password" className="sr-only">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Password"
                  className={`${fieldClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded text-paper/50 transition-colors hover:text-paper disabled:pointer-events-none"
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>

              {error && (
                <p role="alert" className="text-[13px] leading-relaxed text-[#F2B3AB]">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                aria-busy={loading}
                className="relative h-11 w-full overflow-hidden rounded-md bg-paper text-sm font-semibold text-board transition-colors duration-150 hover:bg-white active:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden={loading}
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
                    loading ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  Sign in
                </span>
                <span
                  aria-hidden={!loading}
                  className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150 ${
                    loading ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <SpinnerIcon />
                  Signing in
                </span>
                {/* The same filling rule the Button component carries, so the
                    first thing anyone sees waiting and every wait after it
                    speak the same language. */}
                {loading && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px]">
                    <span className="absolute inset-0 bg-current opacity-[0.18]" />
                    <span className="absolute inset-0 origin-left bg-current animate-work-fill" />
                  </span>
                )}
              </button>
            </form>

            {googleClientId && (
              <div className="mt-3">
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  disabled={busy}
                  scriptFailed={googleScriptFailed}
                />
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-paper/10 pt-5">
              <DemoButton
                label="Demo volunteer"
                pending={demoRole === 'volunteer'}
                disabled={busy}
                onClick={() => handleDemo('volunteer')}
              />
              <DemoButton
                label="Demo coordinator"
                pending={demoRole === 'coordinator'}
                disabled={busy}
                onClick={() => handleDemo('coordinator')}
              />
            </div>
          </main>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
