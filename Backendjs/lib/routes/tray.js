
const express = require('express');
const router = express.Router();
const trayController = require('../controllers/trayController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, trayController.getTrays);
router.post('/', authenticateToken, trayController.createTray);
router.put('/:id', authenticateToken, trayController.updateTray);
router.delete('/:id', authenticateToken, trayController.deleteTray);

module.exports = router;