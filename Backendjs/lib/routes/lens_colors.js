const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const lensColorsController = require('../controllers/lensColorsController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, lensColorsController.getLensColors);
router.get('/:id', authenticateToken, lensColorsController.getLensColorById);
router.post('/', authenticateToken, canWrite, lensColorsController.createLensColor);
router.put('/:id', authenticateToken, canWrite, lensColorsController.updateLensColor);
router.delete('/:id', authenticateToken, noDelete('A lens colour'));

module.exports = router;