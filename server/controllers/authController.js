const User = require('../models/User');
const jwt = require('jsonwebtoken');
const passport = require('../config/passport');

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
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      success: true,
      token: token, // Also send token in response for localStorage fallback
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
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
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

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
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
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

    // Decode the JWT token from Google
    const decoded = jwt.decode(credential);

    if (!decoded || !decoded.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credential'
      });
    }

    // Determine role based on email pattern
    const email = decoded.email;
    let role = 'volunteer'; // Default role
    
    // Check if email starts with 23 or 24 (admin access)
    if (email.startsWith('23') || email.startsWith('24')) {
      role = 'admin';
    }
    // Check if email starts with 25 or 26 (volunteer access)
    else if (email.startsWith('25') || email.startsWith('26')) {
      role = 'volunteer';
    }

    // Check if user exists
    let user = await User.findOne({ email: decoded.email });

    if (!user) {
      // Create new user with role based on email pattern
      user = await User.create({
        googleId: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: role,
      });
    } else if (!user.googleId) {
      // Link Google account to existing user and update role if needed
      user.googleId = decoded.sub;
      
      // Update role based on email pattern if it matches the criteria
      if (email.startsWith('23') || email.startsWith('24')) {
        user.role = 'admin';
      } else if (email.startsWith('25') || email.startsWith('26')) {
        user.role = 'volunteer';
      }
      
      await user.save();
    }

    // Create token
    const token = generateToken(user._id);

    // Set cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      success: true,
      token: token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};
