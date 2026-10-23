const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

// Every signed-in user sees only their own rows (the controller scopes by user and role).
router.get('/', authenticateToken, notificationController.getMine);
router.post('/read', authenticateToken, notificationController.markRead);

module.exports = router;
