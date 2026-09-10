const Registration = require('../models/Registration');
const AttendanceSession = require('../models/AttendanceSession');
const TeachingLog = require('../models/TeachingLog');

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

    const [session, existingRegistration] = await Promise.all([
      AttendanceSession.findById(sessionId).lean(),
      Registration.findOne({ userId: req.user.id, sessionId }).lean()
    ]);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Registering for a session that has already finished cannot lead
    // anywhere: attendance can only be recorded inside the session window.
    if (new Date() > session.endTime) {
      return res.status(400).json({
        success: false,
        message: 'This session has already closed.'
      });
    }

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this session'
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

    // Attendance may only be submitted by a registered volunteer, so removing
    // the registration after the fact would leave teaching logs that violate
    // the rule they were checked against.
    const alreadyTaught = await TeachingLog.exists({
      volunteerId: req.user.id,
      sessionId: registration.sessionId
    });

    if (alreadyTaught) {
      return res.status(400).json({
        success: false,
        message: 'You have already recorded attendance for this session, so it cannot be withdrawn.'
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
