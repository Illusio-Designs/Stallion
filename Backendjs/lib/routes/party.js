const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { authenticateToken } = require('../middleware/auth');
const { partyFileUpload } = require('../constants/multer');
const parsePartyFile = require('../middleware/party_parser');

router.get('/', authenticateToken, partyController.getPartie);
router.get('/my', authenticateToken, partyController.getMyParties);
router.get('/salesman/:salesman_id', authenticateToken, partyController.getPartiesBySalesmanId);
router.post('/get', authenticateToken, partyController.getParties);
router.post('/', authenticateToken, partyController.createParty);
router.put('/:id', authenticateToken, partyController.updateParty);
router.delete('/:id', authenticateToken, partyController.deleteParty);
router.post('/byZoneId', authenticateToken, partyController.getPartiesByZoneId);
router.post('/bulk-upload', authenticateToken, partyFileUpload, parsePartyFile);

module.exports = router;