
const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const trayController = require('../controllers/trayController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'tray_manager']);
router.get('/', authenticateToken, trayController.getTrays);
router.post('/', authenticateToken, canWrite, trayController.createTray);
router.put('/:id', authenticateToken, canWrite, trayController.updateTray);
router.delete('/:id', authenticateToken, noDelete('A tray'));

module.exports = router;