const express = require('express');
const router = express.Router();
const frameColorController = require('../controllers/frameColorController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, frameColorController.getFrameColors);
router.get('/:id', authenticateToken, frameColorController.getFrameColorById);
router.post('/', authenticateToken, frameColorController.createFrameColor);
router.put('/:id', authenticateToken, frameColorController.updateFrameColor);
router.delete('/:id', authenticateToken, frameColorController.deleteFrameColor);

module.exports = router;