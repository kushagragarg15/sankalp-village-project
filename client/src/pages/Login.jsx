import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../utils/api';
import { GoogleOAuthProvider, GoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import DotGrid from '../components/DotGrid';
import logoImage from '../assets/sankalp-logo.jpg';

// A faint ruled surface for the board panels — the same structural idea as
// the app's spine and table hairlines, turned into ambient texture instead
// of a functional device. Ledger lines, not chalkboard grunge: systematic,
// quiet, in keeping with a register rather than a classroom mural.
const BOARD_TEXTURE = {
  backgroundImage: [
    'repeating-linear-gradient(to bottom, transparent, transparent 39px, rgba(255,255,255,0.035) 39px, rgba(255,255,255,0.035) 40px)',
    'radial-gradient(ellipse 900px 500px at 12% -8%, rgba(255,255,255,0.05), transparent 60%)',
  ].join(', '),
};

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
      className="flex min-h-[3.5rem] w-full flex-col items-start justify-center rounded-md border border-rule-strong bg-paper px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-board hover:bg-surface active:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-ink">
        {pending && <SpinnerIcon className="text-ink-2" />}
        {pending ? 'Opening demo' : label}
      </span>
      <span className="mt-0.5 text-[12px] text-ink-3">{detail}</span>
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
      <div className="flex h-11 w-full items-center justify-center rounded-md border border-dashed border-rule-strong px-3 text-center text-[13px] text-ink-3">
        Google sign-in isn&rsquo;t available right now — use your email and password above.
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
        className={`absolute inset-0 rounded-md border border-rule bg-surface transition-opacity duration-300 ${
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
            theme="outline"
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
  const [demoOptions, setDemoOptions] = useState({ volunteer: false, coordinator: false });
  const [demoRole, setDemoRole] = useState(null);
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const busy = loading || demoRole !== null;
  const demoAvailable = demoOptions.volunteer || demoOptions.coordinator;

  // The server decides which demo accounts exist; the panel only appears
  // when at least one is configured.
  useEffect(() => {
    let cancelled = false;
    authAPI
      .demoOptions()
      .then((res) => !cancelled && setDemoOptions(res.data.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  const fieldBaseClass =
    'w-full h-11 rounded-md border bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:ring-1 disabled:bg-paper-deep disabled:text-ink-3';
  const fieldToneClass = error
    ? 'border-brick focus:border-brick focus:ring-brick'
    : 'border-rule hover:border-rule-strong focus:border-board focus:ring-board';

  return (
    <GoogleOAuthProvider clientId={googleClientId} onScriptLoadError={() => setGoogleScriptFailed(true)}>
      <div className="flex min-h-screen flex-col bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
        {/* Compact brand band — mobile only. The full register-mark motif needs
            room to read, so it stays a desktop flourish; mobile keeps just the
            essentials: wordmark, the statement, and the one "this is real and
            active" signal. */}
        <div className="relative overflow-hidden bg-board px-5 py-7 sm:px-8 lg:hidden" style={BOARD_TEXTURE}>
          <div className="relative flex animate-rise-in items-center gap-2.5">
            <img src={logoImage} alt="" className="h-8 w-8 rounded object-cover" />
            <span className="type-title text-[15px] text-paper">Sankalp Club</span>
          </div>

          <p
            className="type-display relative mt-5 max-w-[13ch] text-[28px] leading-[1.12] text-paper animate-rise-in"
            style={{ animationDelay: '70ms' }}
          >
            Every lesson, on the record.
          </p>

          <p
            className="relative mt-2.5 max-w-[34ch] text-[13px] leading-relaxed text-board-400 animate-rise-in"
            style={{ animationDelay: '140ms' }}
          >
            Volunteers teach in the village. This is where it gets written down.
          </p>

          <div
            className="relative mt-4 flex items-center gap-2 text-[12px] text-board-400 animate-rise-in"
            style={{ animationDelay: '210ms' }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright animate-rule-pulse" />
            Recorded on site, inside the session window.
          </div>
        </div>

        {/* The blackboard side states what the register is for. */}
        <aside
          className="relative hidden overflow-hidden bg-board p-12 text-paper lg:flex lg:flex-col lg:justify-between xl:p-16"
          style={BOARD_TEXTURE}
        >
          {/* Sits under the ruled-line texture and the copy (both `relative`,
              so they paint above this un-z-indexed absolute layer by DOM
              order). Board tones only — gold stays reserved for the live dot. */}
          <div className="absolute inset-0">
            <DotGrid
              dotSize={3}
              gap={26}
              baseColor="#2A3A35"
              activeColor="#5C716A"
              proximity={110}
              shockRadius={180}
              shockStrength={1.5}
              resistance={800}
              returnDuration={1.1}
            />
          </div>

          <div className="relative flex animate-rise-in items-center gap-3">
            <img src={logoImage} alt="" className="h-9 w-9 rounded object-cover" />
            <span className="type-title text-[16px] text-paper">Sankalp Club</span>
          </div>

          {/* The register mark: a tick and a ruled line, the same grammar the
              rest of the app uses to say "this entry, on this date" — placed
              here as if the page itself is the first line in the book. */}
          <div className="relative flex gap-5">
            <div className="flex w-2.5 shrink-0 flex-col items-center self-stretch">
              <span
                aria-hidden="true"
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-gold-bright shadow-[0_0_0_4px_rgba(233,168,58,0.18)] animate-mark-in"
                style={{ animationDelay: '90ms' }}
              />
              <span
                aria-hidden="true"
                className="mt-1 w-[1.5px] flex-1 origin-top bg-board-400/80 animate-grow-down"
                style={{ animationDelay: '220ms' }}
              />
            </div>

            <div>
              <p
                className="type-display max-w-[13ch] text-[clamp(2.6rem,4.4vw,4rem)] text-paper animate-rise-in"
                style={{ animationDelay: '160ms' }}
              >
                Every lesson, on the record.
              </p>
              <p
                className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-board-400 animate-rise-in"
                style={{ animationDelay: '240ms' }}
              >
                Volunteers teach in the village. This is where the session opens, the
                code goes out, and what each child was taught gets written down.
              </p>
            </div>
          </div>

          <div
            className="relative flex items-center gap-3 text-[13px] text-board-400 animate-rise-in"
            style={{ animationDelay: '320ms' }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-bright animate-rule-pulse" />
            Attendance is recorded on site, inside the session window.
          </div>
        </aside>

        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-12 lg:min-h-screen lg:py-12">
          <div className="w-full max-w-[26rem] animate-rise-in" style={{ animationDelay: '120ms' }}>
            {/* Smaller below lg: the compact band above already carries the
                headline, so "Sign in" only needs to read as a section
                label, not a second competing statement. */}
            <h1 className="type-display text-[24px] text-ink lg:text-[30px]">Sign in</h1>
            <p className="mt-2 text-sm text-ink-2">
              Use the account your coordinator set up for you.
            </p>

            {demoAvailable && (
              <section aria-labelledby="demo-heading" className="mt-7 rounded-md border border-rule bg-surface p-4">
                <h2 id="demo-heading" className="type-title text-[14px] text-ink">
                  Just looking around?
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                  Open the app with sample data — no account needed.
                </p>
                <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {demoOptions.volunteer && (
                    <DemoButton
                      label="Demo as volunteer"
                      detail="Register, log a lesson, ask the AI"
                      pending={demoRole === 'volunteer'}
                      disabled={busy}
                      onClick={() => handleDemo('volunteer')}
                    />
                  )}
                  {demoOptions.coordinator && (
                    <DemoButton
                      label="Demo as coordinator"
                      detail="Run sessions, analytics, AI activity"
                      pending={demoRole === 'coordinator'}
                      disabled={busy}
                      onClick={() => handleDemo('coordinator')}
                    />
                  )}
                </div>
              </section>
            )}

            {error && (
              <div
                role="alert"
                className="mt-6 flex items-start gap-2.5 rounded-md border border-brick-line bg-brick-wash px-3.5 py-3 animate-rise-in"
              >
                <AlertIcon className="mt-0.5 shrink-0 text-brick" />
                <p className="text-[13px] leading-relaxed text-brick">{error}</p>
              </div>
            )}

            {demoAvailable && (
              <div className="mt-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-rule" />
                <span className="text-[13px] text-ink-3">or sign in with your account</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
            )}

            <form onSubmit={handleSubmit} className={`${demoAvailable ? 'mt-5' : 'mt-7'} space-y-4`} noValidate>
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
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
                  <label htmlFor="password" className="text-[13px] font-medium text-ink">
                    Password
                  </label>
                  <span className="text-[12px] text-ink-3">Forgot it? Ask your coordinator.</span>
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
                    className="absolute right-1 top-1 h-9 w-9 inline-flex items-center justify-center rounded text-ink-2 transition-colors hover:text-ink hover:bg-paper active:scale-95 disabled:pointer-events-none"
                  >
                    <EyeIcon crossed={showPassword} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                aria-busy={loading}
                className="relative h-11 w-full overflow-hidden rounded-md bg-board text-sm font-medium text-paper transition-colors duration-150 hover:bg-board-600 active:bg-board-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <>
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-rule" />
                  <span className="text-[13px] text-ink-3">or</span>
                  <span className="h-px flex-1 bg-rule" />
                </div>

                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  disabled={busy}
                  scriptFailed={googleScriptFailed}
                />
              </>
            )}
          </div>
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}
