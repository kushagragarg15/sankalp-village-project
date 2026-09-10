const TeachingLog = require('../models/TeachingLog');
const AttendanceSession = require('../models/AttendanceSession');
const Registration = require('../models/Registration');

// Haversine formula to calculate distance between two coordinates (in meters)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// @desc    Submit teaching log
// @route   POST /api/teaching-logs/submit
// @access  Private
exports.submitTeachingLog = async (req, res, next) => {
  try {
    const { session_id, entries, code, lat, lng } = req.body;

    // Validate input
    if (!session_id || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and at least one entry are required'
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Attendance code is required'
      });
    }

    // Validate each entry
    for (const entry of entries) {
      if (!entry.student_id || !entry.subject || !entry.topic) {
        return res.status(400).json({
          success: false,
          message: 'Each entry must have student_id, subject, and topic'
        });
      }
    }

    // 1 + 3. The session and the volunteer's registration do not depend on each
    // other, so fetch them in parallel instead of paying two serial round trips.
    const [session, registration] = await Promise.all([
      AttendanceSession.findById(session_id).lean(),
      Registration.findOne({ userId: req.user.id, sessionId: session_id }).lean()
    ]);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // 2. Validate session is active (current time between startTime and endTime)
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Session is not currently active'
      });
    }

    if (!registration) {
      return res.status(403).json({
        success: false,
        message: 'You are not registered for this session'
      });
    }

    // 4. Validate code
    if (!session.activeCode || session.activeCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance code'
      });
    }

    if (!session.codeExpiry || now > session.codeExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Attendance code has expired'
      });
    }

    // 5. Validate location (fixed school coordinates with 1km radius for testing)
    const SCHOOL_LAT = 26.933531637176955;
    const SCHOOL_LNG = 75.9162266441557;
    const ALLOWED_RADIUS = 1000; // meters (1km for testing)

    if (lat && lng) {
      const distance = calculateDistance(
        SCHOOL_LAT,
        SCHOOL_LNG,
        lat,
        lng
      );

      if (distance > ALLOWED_RADIUS) {
        return res.status(400).json({
          success: false,
          message: `You must be within ${ALLOWED_RADIUS} meters of the school location. Current distance: ${Math.round(distance)}m`
        });
      }
    }

    // 6. Insert every entry in one unordered batch.
    //
    // This used to be a findOne + create per student: 2 serial round trips each,
    // so a volunteer logging ten children paid twenty. The unique index on
    // (sessionId, volunteerId, studentId) is what actually enforces no
    // double-logging, so we let it do that job and read the duplicates back off
    // the write errors instead of pre-checking for them.
    const docs = entries.map((entry) => ({
      volunteerId: req.user.id,
      sessionId: session_id,
      studentId: entry.student_id,
      subject: entry.subject,
      topic: entry.topic,
      codeUsed: code,
      lat: lat || null,
      lng: lng || null
    }));

    let createdLogs = [];
    let duplicates = [];

    try {
      createdLogs = await TeachingLog.insertMany(docs, { ordered: false });
    } catch (error) {
      // With ordered:false Mongo inserts everything it can and reports the rest.
      if (error.writeErrors || error.code === 11000) {
        const writeErrors = error.writeErrors || [];
        duplicates = writeErrors
          .filter((e) => (e.err?.code || e.code) === 11000)
          .map((e) => docs[e.index ?? e.err?.index]?.studentId)
          .filter(Boolean);

        // Anything that was not a duplicate is a real failure.
        const other = writeErrors.filter((e) => (e.err?.code || e.code) !== 11000);
        if (other.length > 0) throw error;

        createdLogs = error.insertedDocs || [];
      } else {
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully logged ${createdLogs.length} teaching entries`,
      data: {
        created: createdLogs.length,
        duplicates: duplicates.length,
        logs: createdLogs
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teaching logs for a volunteer
// @route   GET /api/teaching-logs/my-logs
// @access  Private
exports.getMyLogs = async (req, res, next) => {
  try {
    const logs = await TeachingLog.find({ volunteerId: req.user.id })
      .populate('sessionId', 'title startTime endTime')
      .populate('studentId', 'name grade')
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get teaching logs for a session
// @route   GET /api/teaching-logs/session/:sessionId
// @access  Private (Admin only)
exports.getSessionLogs = async (req, res, next) => {
  try {
    const logs = await TeachingLog.find({ sessionId: req.params.sessionId })
      .populate('volunteerId', 'name email')
      .populate('studentId', 'name grade')
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all teaching logs (Admin)
// @route   GET /api/teaching-logs
// @access  Private (Admin only)
exports.getAllLogs = async (req, res, next) => {
  try {
    const logs = await TeachingLog.find()
      .populate('volunteerId', 'name email')
      .populate('sessionId', 'title startTime endTime')
      .populate('studentId', 'name grade')
      .sort({ timestamp: -1 })
      .limit(100) // Limit for performance
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};
