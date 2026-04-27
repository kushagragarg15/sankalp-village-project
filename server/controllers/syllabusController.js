const Syllabus = require('../models/Syllabus');

// @desc    Get all syllabi
// @route   GET /api/syllabus
// @access  Private
exports.getAllSyllabus = async (req, res, next) => {
  try {
    const { subject, grade } = req.query;
    
    let query = {};
    if (subject) query.subject = subject;
    if (grade) query.grade = grade;

    const syllabi = await Syllabus.find(query);

    res.status(200).json({
      success: true,
      count: syllabi.length,
      data: syllabi
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single syllabus
// @route   GET /api/syllabus/:id
// @access  Private
exports.getSyllabus = async (req, res, next) => {
  try {
    const syllabus = await Syllabus.findById(req.params.id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: 'Syllabus not found'
      });
    }

    res.status(200).json({
      success: true,
      data: syllabus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new syllabus
// @route   POST /api/syllabus
// @access  Private/Admin
exports.createSyllabus = async (req, res, next) => {
  try {
    const syllabus = await Syllabus.create(req.body);

    res.status(201).json({
      success: true,
      data: syllabus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update syllabus
// @route   PUT /api/syllabus/:id
// @access  Private/Admin
exports.updateSyllabus = async (req, res, next) => {
  try {
    const syllabus = await Syllabus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: 'Syllabus not found'
      });
    }

    res.status(200).json({
      success: true,
      data: syllabus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete syllabus
// @route   DELETE /api/syllabus/:id
// @access  Private/Admin
exports.deleteSyllabus = async (req, res, next) => {
  try {
    const syllabus = await Syllabus.findByIdAndDelete(req.params.id);

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: 'Syllabus not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Syllabus deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
