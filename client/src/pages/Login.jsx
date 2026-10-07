import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LOGIN_PHOTOS } from '../data/loginPhotos';
import { GoogleOAuthProvider, GoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import WitnessGrid from '../components/WitnessGrid';
import logoImage from '../assets/saakshi-mark.svg';

// What makes an entry trustworthy, in the order a volunteer meets them.
const CHECKS = [
  'A code read out in the room',
  'A location check on site',
  'A line for every child taught',
];

// The mark's own tick, so "checked" means the same thing here as in the logo.
function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E9A83A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

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

function AlertIcon({ className = '' }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v6" />
      <path d="M12 16.5h.01" />
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

function DemoButton({ label, detail, pending, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={pending}
      className="flex min-h-[3.5rem] w-full flex-col items-start justify-center rounded-md border border-paper/15 bg-board/70 px-3.5 py-2.5 text-left backdrop-blur-sm transition-colors duration-150 hover:border-paper/35 hover:bg-board-700/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-paper">
        {pending && <SpinnerIcon className="text-paper/70" />}
        {pending ? 'Opening demo' : label}
      </span>
      <span className="mt-0.5 text-[12px] text-paper/55">{detail}</span>
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

  if (scriptFailed) {
    return (
      <div className="flex h-11 w-full items-center justify-center rounded-md border border-dashed border-paper/20 px-3 text-center text-[13px] text-paper/55">
        Google sign-in isn&rsquo;t available right now. Use your email and password.
      </div>
    );
  }

  const ready = scriptLoadedSuccessfully && width > 0;

  return (
    <div
      ref={wrapRef}
      className={`relative h-11 w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 rounded-md border border-paper/15 bg-board/70 transition-opacity duration-300 ${
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
  // A different afternoon from the sessions on each visit.
  const [photo] = useState(() => LOGIN_PHOTOS[Math.floor(Math.random() * LOGIN_PHOTOS.length)]);
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

  // Fields sit straight on the board: translucent so the wall shows through,
  // solid enough that typed text never competes with a bright cell.
  const fieldBaseClass =
    'w-full h-11 rounded-md border bg-board/75 px-3.5 text-[15px] text-paper placeholder:text-paper/40 outline-none backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:bg-board/90 focus:ring-1 disabled:opacity-60';
  const fieldToneClass = error
    ? 'border-[#E58A80] focus:border-[#E58A80] focus:ring-[#E58A80]'
    : 'border-paper/15 hover:border-paper/30 focus:border-gold-bright focus:ring-gold-bright';

  return (
    <GoogleOAuthProvider clientId={googleClientId} onScriptLoadError={() => setGoogleScriptFailed(true)}>
      <div className="relative min-h-screen bg-board text-paper">
        {/* One background for the whole page: an afternoon from the sessions,
            written into the board one record at a time. */}
        <WitnessGrid image={photo.src} label={photo.alt} />

        {/* Shade so every word stays readable over any photo: heavier on the
            left under the headline and on the right under the form, lighter
            through the middle where the picture can breathe. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_top,rgba(23,33,31,0.9)_0%,rgba(23,33,31,0.5)_50%,rgba(23,33,31,0.2)_100%)] lg:bg-[linear-gradient(to_right,rgba(23,33,31,0.35)_0%,rgba(23,33,31,0.05)_42%,rgba(23,33,31,0.72)_68%,rgba(23,33,31,0.86)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 hidden bg-[linear-gradient(to_top,rgba(23,33,31,0.85)_0%,rgba(23,33,31,0.4)_30%,rgba(23,33,31,0)_55%),linear-gradient(to_bottom,rgba(23,33,31,0.6)_0%,rgba(23,33,31,0)_18%)] lg:block"
        />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12 xl:px-16">
          <header className="flex items-center gap-2.5">
            <img src={logoImage} alt="" className="h-9 w-9 rounded" />
            <span className="type-title text-[17px] text-paper">Saakshi</span>
            <span className="text-[13px] text-paper/70">for Sankalp Club</span>
          </header>

          <div className="flex flex-1 flex-col justify-end gap-12 pt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end lg:gap-16 lg:pt-12 xl:gap-24">
            <section>
              <h1
                className="max-w-[11ch] text-[clamp(2.4rem,5.6vw,5.5rem)] leading-[0.96] tracking-[-0.03em] text-paper"
                style={{ fontStretch: '125%', fontWeight: 800 }}
              >
                Good work deserves a witness.
              </h1>
              <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-paper/80 lg:mt-6 lg:text-[16px]">
                Volunteers teach, feed and care for people every weekend, and most of that work is
                never written down. Saakshi records it where it happens, so the volunteers, the people
                they serve and the people who fund them can all trust that it happened.
              </p>
              <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 lg:mt-7">
                {CHECKS.map((check) => (
                  <li key={check} className="flex items-center gap-2 text-[13px] text-paper/90 sm:text-[14px]">
                    <Tick />
                    {check}
                  </li>
                ))}
              </ul>
              <Link
                to="/village"
                className="mt-6 inline-block text-[13px] text-paper/60 underline-offset-4 transition-colors hover:text-paper hover:underline lg:mt-8"
              >
                See the village we teach in
              </Link>
            </section>

            <main className="w-full max-w-[26rem] lg:max-w-none">
              <h2 className="type-display text-[26px] text-paper lg:text-[30px]">Sign in</h2>
              <p className="mt-2 text-sm text-paper/70">
                Use the account your coordinator set up for you.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DemoButton
                  label="Demo as volunteer"
                  detail="One click, sample data"
                  pending={demoRole === 'volunteer'}
                  disabled={busy}
                  onClick={() => handleDemo('volunteer')}
                />
                <DemoButton
                  label="Demo as coordinator"
                  detail="One click, sample data"
                  pending={demoRole === 'coordinator'}
                  disabled={busy}
                  onClick={() => handleDemo('coordinator')}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-md border border-[#E58A80]/50 bg-[#A32C24]/30 px-3.5 py-3 backdrop-blur-sm animate-rise-in"
                >
                  <AlertIcon className="mt-0.5 shrink-0 text-[#F2B3AB]" />
                  <p className="text-[13px] leading-relaxed text-[#F7D2CD]">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-paper/85">
                    Email
                  </label>
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
                    placeholder="you@lnmiit.ac.in"
                    className={`${fieldBaseClass} ${fieldToneClass}`}
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label htmlFor="password" className="text-[13px] font-medium text-paper/85">
                      Password
                    </label>
                    <span className="text-[12px] text-paper/55">Forgot it? Ask your coordinator.</span>
                  </div>
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
                      placeholder="Your password"
                      className={`${fieldBaseClass} ${fieldToneClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={busy}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper active:scale-95 disabled:pointer-events-none"
                    >
                      <EyeIcon crossed={showPassword} />
                    </button>
                  </div>
                </div>

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

              <p className="mt-8 text-[12px] text-paper/50">
                Saakshi (<span lang="hi">साक्षी</span>) is Hindi for witness.
              </p>
            </main>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
