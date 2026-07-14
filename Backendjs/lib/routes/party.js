const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { authenticateToken } = require('../middleware/auth');
const { isPartyManager, isPartyCreator } = require('../middleware/roleAuth');
const { partyFileUpload } = require('../constants/multer');
const parsePartyFile = require('../middleware/party_parser');

router.get('/', authenticateToken, (req, res) => partyController.getPartiesRoot(req, res));
router.get('/my', authenticateToken, partyController.getMyParties);
// Diagnostic: does the server's geocoder work? GET /parties/geocode-test?q=...
// (declared before '/:id' so it isn't captured as an id)
router.get('/geocode-test', authenticateToken, partyController.geocodeTest);
router.get('/salesman/:salesman_id', authenticateToken, partyController.getPartiesBySalesmanId);
router.get('/:id', authenticateToken, partyController.getPartyById);
router.post('/get', authenticateToken, isPartyManager, partyController.getParties);
router.post('/', authenticateToken, isPartyCreator, partyController.createParty);
// Admin-only: set a party's exact GPS location, or (re)derive coordinates from
// its address. Declared before '/:id' so the suffix isn't swallowed.
router.put('/:id/location', authenticateToken, partyController.setPartyLocation);
router.put('/:id/geocode', authenticateToken, partyController.geocodePartyLocation);
router.put('/:id', authenticateToken, partyController.updateParty);
router.delete('/:id', authenticateToken, isPartyManager, partyController.deleteParty);
router.post('/byZoneId', authenticateToken, partyController.getPartiesByZoneId);
router.post('/byStateId', authenticateToken, partyController.getPartiesByStateId);
// Proactively geocode parties that have an address but no coordinates yet.
router.post('/backfill-coords', authenticateToken, isPartyManager, partyController.backfillPartyCoords);
router.post('/bulk-upload', authenticateToken, isPartyManager, partyFileUpload, parsePartyFile);

module.exports = router;
