const express = require('express');
const router = express.Router();
const frameColorController = require('../controllers/frameColorController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, frameColorController.getFrameColors);
router.get('/:id', authenticateToken, frameColorController.getFrameColorById);
router.post('/', authenticateToken, canWrite, frameColorController.createFrameColor);
router.put('/:id', authenticateToken, canWrite, frameColorController.updateFrameColor);
router.delete('/:id', authenticateToken, canWrite, frameColorController.deleteFrameColor);

module.exports = router;