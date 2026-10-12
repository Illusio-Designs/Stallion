
const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin']);
router.get('/:id', authenticateToken, zoneController.getZoneById);
router.post('/get', authenticateToken, zoneController.getZones);
router.post('/my', authenticateToken, zoneController.getMyZones);
router.post('/', authenticateToken, canWrite, zoneController.createZone);
router.put('/:id', authenticateToken, canWrite, zoneController.updateZone);
router.delete('/:id', authenticateToken, canWrite, zoneController.deleteZone);

module.exports = router;