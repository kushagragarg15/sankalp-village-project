const AttendanceSession = require('../models/AttendanceSession');

// Generate random 5-character code
const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// @desc    Create new attendance session
// @route   POST /api/attendance-sessions/create
// @access  Private (Admin only)
exports.createSession = async (req, res, next) => {
  try {
    const { title, startTime, endTime, location } = req.body;

    // Validate required fields
    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Title, start time, and end time are required'
      });
    }

    // Validate time range
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    const session = await AttendanceSession.create({
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location: location || { lat: null, lng: null },
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate attendance code for session
// @route   POST /api/attendance-sessions/:id/generate-code
// @access  Private (Admin only)
exports.generateCode = async (req, res, next) => {
  try {
    const session = await AttendanceSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Generate new code
    const code = generateRandomCode();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    session.activeCode = code;
    session.codeExpiry = expiry;
    await session.save();

    res.status(200).json({
      success: true,
      data: {
        code,
        expiry
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sessions
// @route   GET /api/attendance-sessions
// @access  Private
exports.getAllSessions = async (req, res, next) => {
  try {
    const sessions = await AttendanceSession.find()
      .populate('createdBy', 'name email')
      .sort({ startTime: -1 });

    const now = new Date();

    // Auto-generate codes for active sessions that don't have a valid code
    for (const session of sessions) {
      const isActive = now >= session.startTime && now <= session.endTime;
      const hasValidCode = session.activeCode && session.codeExpiry && now < session.codeExpiry;

      if (isActive && !hasValidCode) {
        // Generate new code
        const code = generateRandomCode();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        session.activeCode = code;
        session.codeExpiry = expiry;
        await session.save();
      }
    }

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single session
// @route   GET /api/attendance-sessions/:id
// @access  Private
exports.getSession = async (req, res, next) => {
  try {
    const session = await AttendanceSession.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete session
// @route   DELETE /api/attendance-sessions/:id
// @access  Private (Admin only)
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await AttendanceSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    await session.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
