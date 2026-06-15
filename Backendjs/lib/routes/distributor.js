
const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, distributorController.getDistributor);
router.get('/parties', authenticateToken, distributorController.getDistributorParties);
router.get('/by-state/:stateId', authenticateToken, distributorController.getDistributorsByState);
router.get('/:id', authenticateToken, distributorController.getDistributorById);
router.post('/', authenticateToken, distributorController.createDistributor);
router.post('/get', authenticateToken, distributorController.getDistributors);
router.put('/:id', authenticateToken, distributorController.updateDistributor);
router.delete('/:id', authenticateToken, distributorController.deleteDistributor);

module.exports = router;