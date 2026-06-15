
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, eventController.getEvents);
router.post('/', authenticateToken, eventController.createEvent);
router.put('/:id', authenticateToken, eventController.updateEvent);
router.delete('/:id', authenticateToken, eventController.deleteEvent);

module.exports = router;