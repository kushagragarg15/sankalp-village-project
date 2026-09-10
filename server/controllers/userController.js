const User = require('../models/User');
const { invalidateUser } = require('../middleware/auth');

const ROLES = ['admin', 'volunteer'];

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'volunteer', phone = '' } = req.body;

    // req.body used to be passed straight through, so a malformed request
    // failed deep inside Mongoose with an unhelpful message.
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${ROLES.join(', ')}`
      });
    }

    const normalised = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalised }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Somebody already has an account with that email'
      });
    }

    const user = await User.create({
      name,
      email: normalised,
      password,
      role,
      phone
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
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

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    // Don't allow password update through this route
    if (req.body.password) {
      delete req.body.password;
    }

    if (req.body.role && !ROLES.includes(req.body.role)) {
      return res.status(400).json({
        success: false,
        message: `Role must be one of: ${ROLES.join(', ')}`
      });
    }

    // An admin must not be able to remove their own admin rights and lock the
    // club out of its own coordinator screens.
    if (req.body.role === 'volunteer' && String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own coordinator access. Ask another coordinator to do it.'
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // The auth middleware caches users briefly; drop this one so a role change
    // takes effect on the very next request instead of up to 15s later.
    invalidateUser(req.params.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.'
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Otherwise a deleted user could keep making requests until their cached
    // record expired.
    invalidateUser(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
