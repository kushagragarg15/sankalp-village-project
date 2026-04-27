const Event = require('../models/Event');
const User = require('../models/User');
const Student = require('../models/Student');

// @desc    Get all events
// @route   GET /api/events
// @access  Private
exports.getEvents = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .populate('volunteersPresent.volunteer', 'name email')
      .populate('sessions.volunteer', 'name email')
      .populate('sessions.studentsPresent', 'name grade')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('volunteersPresent.volunteer', 'name email phone')
      .populate('sessions.volunteer', 'name email')
      .populate('sessions.studentsPresent', 'name grade');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new event
// @route   POST /api/events
// @access  Private/Admin
exports.createEvent = async (req, res, next) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user.id
    };

    const event = await Event.create(eventData);

    const populatedEvent = await Event.findById(event._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: populatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private/Admin
exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('createdBy', 'name email')
      .populate('volunteersPresent.volunteer', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private/Admin
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Remove event from student attendance
    await Student.updateMany(
      { attendance: event._id },
      { $pull: { attendance: event._id } }
    );

    // Remove event from volunteer attendance
    await User.updateMany(
      { 'attendance.event': event._id },
      { $pull: { attendance: { event: event._id } } }
    );

    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Volunteer check-in via QR code
// @route   POST /api/events/checkin
// @access  Private
exports.volunteerCheckIn = async (req, res, next) => {
  try {
    const { qrCode } = req.body;

    const event = await Event.findOne({ qrCode });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code or event not found'
      });
    }

    // Check if volunteer already checked in
    const alreadyCheckedIn = event.volunteersPresent.some(
      v => v.volunteer.toString() === req.user.id
    );

    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked in for this event'
      });
    }

    // Add volunteer to event
    event.volunteersPresent.push({
      volunteer: req.user.id,
      checkInTime: new Date(),
      checkInMethod: 'qr'
    });

    // Add event to volunteer's attendance
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        attendance: {
          event: event._id,
          checkInTime: new Date(),
          checkInMethod: 'qr'
        }
      }
    });

    await event.save();

    const updatedEvent = await Event.findById(event._id)
      .populate('volunteersPresent.volunteer', 'name email');

    res.status(200).json({
      success: true,
      message: 'Check-in successful',
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual volunteer check-in (Admin only)
// @route   POST /api/events/:id/checkin-manual
// @access  Private/Admin
exports.manualVolunteerCheckIn = async (req, res, next) => {
  try {
    const { volunteerId } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if volunteer already checked in
    const alreadyCheckedIn = event.volunteersPresent.some(
      v => v.volunteer.toString() === volunteerId
    );

    if (alreadyCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'Volunteer already checked in'
      });
    }

    // Add volunteer to event
    event.volunteersPresent.push({
      volunteer: volunteerId,
      checkInTime: new Date(),
      checkInMethod: 'manual'
    });

    // Add event to volunteer's attendance
    await User.findByIdAndUpdate(volunteerId, {
      $push: {
        attendance: {
          event: event._id,
          checkInTime: new Date(),
          checkInMethod: 'manual'
        }
      }
    });

    await event.save();

    const updatedEvent = await Event.findById(event._id)
      .populate('volunteersPresent.volunteer', 'name email');

    res.status(200).json({
      success: true,
      message: 'Manual check-in successful',
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add teaching session to event
// @route   POST /api/events/:id/sessions
// @access  Private
exports.addSession = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const sessionData = {
      ...req.body,
      volunteer: req.user.id
    };

    event.sessions.push(sessionData);

    // Update student attendance
    if (req.body.studentsPresent && req.body.studentsPresent.length > 0) {
      await Student.updateMany(
        { _id: { $in: req.body.studentsPresent } },
        { $addToSet: { attendance: event._id } }
      );
    }

    await event.save();

    const updatedEvent = await Event.findById(event._id)
      .populate('sessions.volunteer', 'name email')
      .populate('sessions.studentsPresent', 'name grade');

    res.status(200).json({
      success: true,
      data: updatedEvent
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming events
// @route   GET /api/events/upcoming
// @access  Private
exports.getUpcomingEvents = async (req, res, next) => {
  try {
    const events = await Event.find({
      date: { $gte: new Date() },
      status: { $in: ['upcoming', 'ongoing'] }
    })
      .populate('createdBy', 'name email')
      .populate('volunteersPresent.volunteer', 'name email')
      .sort({ date: 1 })
      .limit(10);

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};
