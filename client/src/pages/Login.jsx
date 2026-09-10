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
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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

  const fieldClass =
    'w-full h-11 rounded-md border bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-board focus:ring-1 focus:ring-board';

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
        {/* The blackboard side states what the register is for. */}
        <aside className="hidden lg:flex flex-col justify-between bg-board text-paper p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="" className="h-9 w-9 rounded object-cover" />
            <span className="type-title text-[16px] text-paper">Sankalp Club</span>
          </div>

          <div>
            <p className="type-display max-w-[13ch] text-[clamp(2.6rem,4.4vw,4rem)] text-paper">
              Every lesson, on the record.
            </p>
            <p className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-board-400">
              Volunteers teach in the village. This is where the session opens, the
              code goes out, and what each child was taught gets written down.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[13px] text-board-400">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
            Attendance is recorded on site, inside the session window.
          </div>
        </aside>

        <main className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[26rem]">
            <div className="flex items-center gap-2.5 lg:hidden">
              <img src={logoImage} alt="" className="h-8 w-8 rounded object-cover" />
              <span className="type-title text-[15px] text-ink">Sankalp Club</span>
            </div>

            <h1 className="type-display mt-8 text-[30px] text-ink lg:mt-0">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Use the account your coordinator set up for you.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-md border border-brick-line bg-brick-wash px-3.5 py-3"
              >
                <p className="text-[13px] text-brick">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-ink mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="you@lnmiit.ac.in"
                  className={`${fieldClass} ${error ? 'border-brick' : 'border-rule-strong'}`}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-ink mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Your password"
                    className={`${fieldClass} pr-11 ${error ? 'border-brick' : 'border-rule-strong'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1 h-9 w-9 inline-flex items-center justify-center rounded text-ink-2 hover:text-ink hover:bg-paper transition-colors"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
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
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-md bg-board text-paper text-sm font-medium transition-colors hover:bg-board-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in' : 'Sign in'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-rule" />
              <span className="text-[13px] text-ink-3">or</span>
              <span className="h-px flex-1 bg-rule" />
            </div>

            <div className="[&_iframe]:!w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setError('Google sign-in was cancelled. Try again or use your password.')
                }
                theme="outline"
                size="large"
                width="100%"
                text="continue_with"
              />
            </div>

            <p className="mt-8 text-[13px] text-ink-2">
              No account yet? Ask a Sankalp coordinator to add you — accounts are
              created by the club, not self-registered.
            </p>
          </div>
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}
