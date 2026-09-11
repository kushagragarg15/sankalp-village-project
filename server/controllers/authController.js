const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

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
  _id: user._id,
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone
});

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = generateToken(user._id);

    // Set cookie with token (httpOnly for security)
    res.cookie('token', token, {
      ...cookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      success: true,
      token: token, // Also send token in response for localStorage fallback
      data: publicUser(user)
    });
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

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // `protect` already loaded the projected user, so re-querying here only
    // bought a second round trip and the unbounded `attendance` array.
    res.status(200).json({
      success: true,
      data: req.user
    });
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
      return res.status(400).json({
        success: false,
        message: 'No credential provided'
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: 'Google sign-in is not configured on the server.'
      });
    }

    // Verify the credential against Google's signing keys.
    //
    // This was `jwt.decode(credential)`, which only base64-decodes the payload
    // and verifies nothing — anyone could hand the server a self-made token
    // claiming any email address and be signed in as that person.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Google sign-in could not be verified. Please try again.'
      });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'That Google account does not have a verified email address.'
      });
    }

    const email = payload.email.toLowerCase();

    // Optionally restrict sign-in to the institute domain.
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
    if (allowedDomain && !email.endsWith(`@${allowedDomain.toLowerCase()}`)) {
      return res.status(403).json({
        success: false,
        message: `Sign in with your @${allowedDomain} account.`
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Everyone starts as a volunteer. Admin is granted deliberately by an
      // existing admin; it is never inferred from the address, which used to
      // make every 2023/24 batch email an administrator of the whole club.
      user = await User.create({
        googleId: payload.sub,
        name: payload.name || email.split('@')[0],
        email,
        role: 'volunteer'
      });
    } else if (!user.googleId) {
      // Link the Google identity to the existing account, and leave the role
      // untouched: signing in must never change someone's permissions, or a
      // deliberate demotion is silently undone at their next login.
      user.googleId = payload.sub;
      await user.save();
    }

    // Create token
    const token = generateToken(user._id);

    // Set cookie with token
    res.cookie('token', token, {
      ...cookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      success: true,
      token: token,
      data: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};
