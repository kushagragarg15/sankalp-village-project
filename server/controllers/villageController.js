const Village = require('../models/Village');
const Session = require('../models/Session');

// @desc    Get all villages
// @route   GET /api/villages
// @access  Private
exports.getVillages = async (req, res, next) => {
  try {
    const villages = await Village.find().populate('assignedVolunteers', 'name email');

    res.status(200).json({
      success: true,
      count: villages.length,
      data: villages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single village
// @route   GET /api/villages/:id
// @access  Private
exports.getVillage = async (req, res, next) => {
  try {
    const village = await Village.findById(req.params.id).populate('assignedVolunteers', 'name email');

    if (!village) {
      return res.status(404).json({
        success: false,
        message: 'Village not found'
      });
    }

    // Get last session date for gap detection
    const lastSession = await Session.findOne({ village: req.params.id })
      .sort({ date: -1 })
      .select('date');

    const villageData = village.toObject();
    villageData.lastSessionDate = lastSession ? lastSession.date : null;

    // Calculate days since last session
    if (lastSession) {
      const daysSinceLastSession = Math.floor(
        (Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      villageData.daysSinceLastSession = daysSinceLastSession;
      villageData.hasGap = daysSinceLastSession >= 14;
    } else {
      villageData.daysSinceLastSession = null;
      villageData.hasGap = true;
    }

    res.status(200).json({
      success: true,
      data: villageData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new village
// @route   POST /api/villages
// @access  Private/Admin
exports.createVillage = async (req, res, next) => {
  try {
    const village = await Village.create(req.body);

    res.status(201).json({
      success: true,
      data: village
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update village
// @route   PUT /api/villages/:id
// @access  Private/Admin
exports.updateVillage = async (req, res, next) => {
  try {
    const village = await Village.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!village) {
      return res.status(404).json({
        success: false,
        message: 'Village not found'
      });
    }

    res.status(200).json({
      success: true,
      data: village
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete village
// @route   DELETE /api/villages/:id
// @access  Private/Admin
exports.deleteVillage = async (req, res, next) => {
  try {
    const village = await Village.findByIdAndDelete(req.params.id);

    if (!village) {
      return res.status(404).json({
        success: false,
        message: 'Village not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Village deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
