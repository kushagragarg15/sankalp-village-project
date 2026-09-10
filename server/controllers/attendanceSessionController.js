const AttendanceSession = require('../models/AttendanceSession');

// How long an issued code stays valid.
const CODE_TTL_MS = 10 * 60 * 1000;

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
    const expiry = new Date(Date.now() + CODE_TTL_MS);

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
      .sort({ startTime: -1 })
      .lean();

    const now = new Date();

    // Rotate codes for any running session whose code has lapsed.
    //
    // The client polls this endpoint, so this ran on every poll. It used to
    // `await session.save()` one session at a time inside the loop, adding a
    // serial round trip per session even though the writes are independent.
    // Now the whole rotation is a single bulkWrite, and sessions that already
    // hold a valid code cost nothing at all.
    const stale = sessions.filter((session) => {
      const isActive = now >= session.startTime && now <= session.endTime;
      const hasValidCode =
        session.activeCode && session.codeExpiry && now < session.codeExpiry;
      return isActive && !hasValidCode;
    });

    if (stale.length > 0) {
      const expiry = new Date(Date.now() + CODE_TTL_MS);

      await AttendanceSession.bulkWrite(
        stale.map((session) => {
          // Mutate the copy we are about to send so the response carries the
          // fresh code without re-reading it.
          session.activeCode = generateRandomCode();
          session.codeExpiry = expiry;

          return {
            updateOne: {
              filter: { _id: session._id },
              update: {
                $set: {
                  activeCode: session.activeCode,
                  codeExpiry: expiry
                }
              }
            }
          };
        })
      );
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
      .populate('createdBy', 'name email')
      .lean();

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
