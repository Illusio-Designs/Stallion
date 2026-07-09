const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { authenticateToken } = require('../middleware/auth');
const { isPartyManager, isPartyCreator } = require('../middleware/roleAuth');
const { partyFileUpload } = require('../constants/multer');
const parsePartyFile = require('../middleware/party_parser');

router.get('/', authenticateToken, (req, res) => partyController.getPartiesRoot(req, res));
router.get('/my', authenticateToken, partyController.getMyParties);
router.get('/salesman/:salesman_id', authenticateToken, partyController.getPartiesBySalesmanId);
router.get('/:id', authenticateToken, partyController.getPartyById);
router.post('/get', authenticateToken, isPartyManager, partyController.getParties);
router.post('/', authenticateToken, isPartyCreator, partyController.createParty);
router.put('/:id', authenticateToken, partyController.updateParty);
router.delete('/:id', authenticateToken, isPartyManager, partyController.deleteParty);
router.post('/byZoneId', authenticateToken, partyController.getPartiesByZoneId);
router.post('/byStateId', authenticateToken, partyController.getPartiesByStateId);
// Proactively geocode parties that have an address but no coordinates yet.
router.post('/backfill-coords', authenticateToken, isPartyManager, partyController.backfillPartyCoords);
router.post('/bulk-upload', authenticateToken, isPartyManager, partyFileUpload, parsePartyFile);

module.exports = router;
