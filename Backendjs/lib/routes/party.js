const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, partyController.getPartie);
router.post('/get', authenticateToken, partyController.getParties);
router.post('/', authenticateToken, partyController.createParty);
router.put('/:id', authenticateToken, partyController.updateParty);
router.delete('/:id', authenticateToken, partyController.deleteParty);
router.post('/byZoneId', authenticateToken, partyController.getPartiesByZoneId);

module.exports = router;