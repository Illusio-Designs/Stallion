
const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { authenticateToken } = require('../middleware/auth');

router.post('/get', authenticateToken, zoneController.getZones);
router.post('/my', authenticateToken, zoneController.getMyZones);
router.post('/', authenticateToken, zoneController.createZone);
router.put('/:id', authenticateToken, zoneController.updateZone);
router.delete('/:id', authenticateToken, zoneController.deleteZone);

module.exports = router;