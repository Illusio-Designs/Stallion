
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'tray_manager']);
router.get('/', authenticateToken, eventController.getEvents);
router.post('/', authenticateToken, canWrite, eventController.createEvent);
router.put('/:id', authenticateToken, canWrite, eventController.updateEvent);
router.delete('/:id', authenticateToken, canWrite, eventController.deleteEvent);

module.exports = router;