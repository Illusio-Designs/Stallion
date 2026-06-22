const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

// Admin only — create / manage offers.
router.get('/', authenticateToken, isAdmin, offerController.getOffers);
router.post('/', authenticateToken, isAdmin, offerController.createOffer);
router.put('/:id', authenticateToken, isAdmin, offerController.updateOffer);
router.delete('/:id', authenticateToken, isAdmin, offerController.deleteOffer);

// Any authenticated order-placing user (salesman/distributor/party) — list the
// offers that apply to a given cart, with the discount computed for it.
router.post('/available', authenticateToken, offerController.getAvailableOffers);

module.exports = router;
