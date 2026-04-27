const Session = require('../models/Session');
const Student = require('../models/Student');
const Syllabus = require('../models/Syllabus');

// @desc    Get all sessions
// @route   GET /api/sessions
// @access  Private
exports.getSessions = async (req, res, next) => {
  try {
    let query = {};

    // Filter by village if provided
    if (req.query.village) {
      query.village = req.query.village;
    }

    // Filter by volunteer if provided
    if (req.query.volunteer) {
      query.volunteer = req.query.volunteer;
    }

    // Filter by subject if provided
    if (req.query.subject) {
      query.subject = req.query.subject;
    }

    const sessions = await Session.find(query)
      .populate('volunteer', 'name email')
      .populate('village', 'name district')
      .populate('attendees', 'name grade')
      .sort({ date: -1 });

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
// @route   GET /api/sessions/:id
// @access  Private
exports.getSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('volunteer', 'name email')
      .populate('village', 'name district')
      .populate('attendees', 'name grade');

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

// @desc    Get sessions by village
// @route   GET /api/sessions/village/:villageId
// @access  Private
exports.getSessionsByVillage = async (req, res, next) => {
  try {
    const sessions = await Session.find({ village: req.params.villageId })
      .populate('volunteer', 'name email')
      .populate('attendees', 'name grade')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get session planner for a village
// @route   GET /api/sessions/planner/:villageId
// @access  Private
exports.getSessionPlanner = async (req, res, next) => {
  try {
    const { villageId } = req.params;
    const { subject, grade } = req.query;

    // Get last 3 sessions for this village
    const recentSessions = await Session.find({ village: villageId })
      .sort({ date: -1 })
      .limit(3)
      .populate('attendees', 'name grade');

    // Get syllabus for the subject and grade
    let nextTopic = null;
    if (subject && grade) {
      const syllabus = await Syllabus.findOne({ subject, grade });
      
      if (syllabus) {
        // Find the last covered topic in this subject
        const lastSessionInSubject = await Session.findOne({ 
          village: villageId, 
          subject 
        }).sort({ date: -1 });

        if (lastSessionInSubject) {
          // Find the next topic in syllabus
          const lastTopicIndex = syllabus.topics.findIndex(
            t => t.title === lastSessionInSubject.topicCovered
          );
          
          if (lastTopicIndex !== -1 && lastTopicIndex < syllabus.topics.length - 1) {
            nextTopic = syllabus.topics[lastTopicIndex + 1];
          }
        } else {
          // No session yet, start with first topic
          nextTopic = syllabus.topics[0];
        }
      }
    }

    // Get students who missed the last session
    let studentsMissedLast = [];
    if (recentSessions.length > 0) {
      const lastSession = recentSessions[0];
      const allStudents = await Student.find({ village: villageId }).select('name grade');
      const attendedIds = lastSession.attendees.map(a => a._id.toString());
      
      studentsMissedLast = allStudents.filter(
        student => !attendedIds.includes(student._id.toString())
      );
    }

    res.status(200).json({
      success: true,
      data: {
        recentSessions,
        nextRecommendedTopic: nextTopic,
        studentsMissedLastSession: studentsMissedLast
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new session
// @route   POST /api/sessions
// @access  Private
exports.createSession = async (req, res, next) => {
  try {
    const session = await Session.create(req.body);

    // Update attendance for all students who attended
    if (req.body.attendees && req.body.attendees.length > 0) {
      await Student.updateMany(
        { _id: { $in: req.body.attendees } },
        { $addToSet: { attendance: session._id } }
      );
    }

    const populatedSession = await Session.findById(session._id)
      .populate('volunteer', 'name email')
      .populate('village', 'name district')
      .populate('attendees', 'name grade');

    res.status(201).json({
      success: true,
      data: populatedSession
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update session
// @route   PUT /api/sessions/:id
// @access  Private
exports.updateSession = async (req, res, next) => {
  try {
    const oldSession = await Session.findById(req.params.id);

    if (!oldSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // If attendees changed, update student records
    if (req.body.attendees) {
      // Remove this session from students who are no longer attending
      const removedStudents = oldSession.attendees.filter(
        id => !req.body.attendees.includes(id.toString())
      );
      
      if (removedStudents.length > 0) {
        await Student.updateMany(
          { _id: { $in: removedStudents } },
          { $pull: { attendance: oldSession._id } }
        );
      }

      // Add this session to new attendees
      const newStudents = req.body.attendees.filter(
        id => !oldSession.attendees.map(a => a.toString()).includes(id)
      );
      
      if (newStudents.length > 0) {
        await Student.updateMany(
          { _id: { $in: newStudents } },
          { $addToSet: { attendance: oldSession._id } }
        );
      }
    }

    const session = await Session.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('volunteer', 'name email')
      .populate('village', 'name district')
      .populate('attendees', 'name grade');

    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete session
// @route   DELETE /api/sessions/:id
// @access  Private/Admin
exports.deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Remove this session from all students' attendance
    await Student.updateMany(
      { attendance: session._id },
      { $pull: { attendance: session._id } }
    );

    await session.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
