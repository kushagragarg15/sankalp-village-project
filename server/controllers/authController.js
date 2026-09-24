const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { eq } = require('drizzle-orm');
const { getDb } = require('../db');
const { users } = require('../db/schema');
const { comparePassword } = require('../utils/password');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Set and clear must use identical attributes, or the browser treats them as
// different cookies and logout leaves the original one in place.
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
});

// One shape for the signed-in user, so /auth/login, /auth/google and /auth/me
// all hand the client the same thing.
const publicUser = (user) => ({
  _id: user.id,
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  isSuperAdmin: user.isSuperAdmin
});

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// One-click demo sign-in for people looking at the project (recruiters,
// reviewers). Each demo role maps to an existing seeded account; the env var
// overrides it, and setting it to an empty string turns that demo off. The
// account's role is checked, never set: a misconfigured email cannot turn
// anyone into a coordinator, and a super admin is never handed out.
const DEMO_ACCOUNTS = {
  volunteer: { env: 'DEMO_VOLUNTEER_EMAIL', fallback: '23ucc501@lnmiit.ac.in', role: 'volunteer' },
  coordinator: { env: 'DEMO_COORDINATOR_EMAIL', fallback: '22ucc430@lnmiit.ac.in', role: 'admin' }
};
const DEMO_SESSION_MS = 4 * 60 * 60 * 1000;

const demoEmail = (kind) => {
  const { env, fallback } = DEMO_ACCOUNTS[kind];
  return (process.env[env] ?? fallback).toLowerCase().trim();
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, String(email).toLowerCase().trim())).limit(1);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    res.cookie('token', token, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.status(200).json({
      success: true,
      token,
      data: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sign in as the demo volunteer or coordinator
// @route   POST /api/auth/demo
// @access  Public
exports.demoLogin = async (req, res, next) => {
  try {
    const kind = req.body?.role;
    if (!Object.prototype.hasOwnProperty.call(DEMO_ACCOUNTS, kind)) {
      return res.status(400).json({ success: false, message: "Demo role must be 'volunteer' or 'coordinator'." });
    }

    const email = demoEmail(kind);
    if (!email) {
      return res.status(404).json({ success: false, message: 'The demo is not enabled on this server.' });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || user.role !== DEMO_ACCOUNTS[kind].role || user.isSuperAdmin) {
      return res.status(503).json({ success: false, message: 'The demo account is not set up correctly. Try again later.' });
    }

    // `demo` in the token is what lets protect() mark the session, so
    // account-management routes can refuse it (see blockDemoWrites).
    const token = jwt.sign({ id: user.id, demo: true }, process.env.JWT_SECRET, { expiresIn: DEMO_SESSION_MS / 1000 });

    res.cookie('token', token, { ...cookieOptions(), maxAge: DEMO_SESSION_MS });

    res.status(200).json({ success: true, token, data: { ...publicUser(user), isDemo: true } });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    res.clearCookie('token', cookieOptions());
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // `protect` already loaded the projected user.
    res.status(200).json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth callback
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'No credential provided' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured on the server.' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Google sign-in could not be verified. Please try again.' });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ success: false, message: 'That Google account does not have a verified email address.' });
    }

    const email = payload.email.toLowerCase();

    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
    if (allowedDomain && !email.endsWith(`@${allowedDomain.toLowerCase()}`)) {
      return res.status(403).json({ success: false, message: `Sign in with your @${allowedDomain} account.` });
    }

    const db = getDb();
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      // Everyone starts as a volunteer. Admin is granted deliberately by an
      // existing admin; never inferred from the address.
      [user] = await db
        .insert(users)
        .values({ googleId: payload.sub, name: payload.name || email.split('@')[0], email, role: 'volunteer' })
        .returning();
    } else if (!user.googleId) {
      // Link the Google identity to the existing account, and leave the role
      // untouched: signing in must never change someone's permissions.
      [user] = await db.update(users).set({ googleId: payload.sub }).where(eq(users.id, user.id)).returning();
    }

    const token = generateToken(user.id);

    res.cookie('token', token, { ...cookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.status(200).json({ success: true, token, data: publicUser(user) });
  } catch (error) {
    next(error);
  }
};
