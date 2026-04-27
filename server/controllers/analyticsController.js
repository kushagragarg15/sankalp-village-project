const Event = require('../models/Event');
const Student = require('../models/Student');
const User = require('../models/User');

// @desc    Get dashboard stats
// @route   GET /api/analytics/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get counts
    const totalVolunteers = await User.countDocuments({ role: 'volunteer' });
    const totalStudents = await Student.countDocuments();

    // Get events this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const eventsThisMonth = await Event.countDocuments({
      date: { $gte: startOfMonth }
    });

    // Get upcoming events
    const upcomingEvents = await Event.find({
      date: { $gte: new Date() },
      status: { $in: ['upcoming', 'ongoing'] }
    })
      .populate('volunteersPresent.volunteer', 'name')
      .sort({ date: 1 })
      .limit(5);

    // Get recent completed events
    const recentEvents = await Event.find({
      status: 'completed'
    })
      .populate('volunteersPresent.volunteer', 'name')
      .sort({ date: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalVolunteers,
        totalStudents,
        eventsThisMonth,
        upcomingEvents,
        recentEvents
      }
    });
  } catch (error) {
    next(error);
  }
};
