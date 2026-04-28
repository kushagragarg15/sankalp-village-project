const Registration = require('../models/Registration');
const AttendanceSession = require('../models/AttendanceSession');

// @desc    Register volunteer for session
// @route   POST /api/registrations/register
// @access  Private
exports.registerForSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Check if session exists
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if already registered
    const existingRegistration = await Registration.findOne({
      userId: req.user.id,
      sessionId
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'Already registered for this session'
      });
    }

    // Create registration
    const registration = await Registration.create({
      userId: req.user.id,
      sessionId
    });

    res.status(201).json({
      success: true,
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's registrations
// @route   GET /api/registrations/my-registrations
// @access  Private
exports.getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ userId: req.user.id })
      .populate('sessionId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get registrations for a session
// @route   GET /api/registrations/session/:sessionId
// @access  Private (Admin only)
exports.getSessionRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ sessionId: req.params.sessionId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unregister from session
// @route   DELETE /api/registrations/:id
// @access  Private
exports.unregister = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check ownership
    if (registration.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this registration'
      });
    }

    await registration.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Unregistered successfully'
    });
  } catch (error) {
    next(error);
  }
};
