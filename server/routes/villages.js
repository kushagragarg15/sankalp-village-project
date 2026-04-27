const express = require('express');
const {
  getVillages,
  getVillage,
  createVillage,
  updateVillage,
  deleteVillage
} = require('../controllers/villageController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getVillages)
  .post(authorize('admin'), createVillage);

router.route('/:id')
  .get(getVillage)
  .put(authorize('admin'), updateVillage)
  .delete(authorize('admin'), deleteVillage);

module.exports = router;
