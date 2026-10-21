
const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'distributor_manager']);
router.get('/', authenticateToken, distributorController.getDistributor);
router.get('/parties', authenticateToken, distributorController.getDistributorParties);
router.get('/by-state/:stateId', authenticateToken, distributorController.getDistributorsByState);
router.get('/:id', authenticateToken, distributorController.getDistributorById);
router.post('/', authenticateToken, canWrite, distributorController.createDistributor);
router.post('/get', authenticateToken, distributorController.getDistributors);
router.put('/:id', authenticateToken, canWrite, distributorController.updateDistributor);
router.delete('/:id', authenticateToken, noDelete('A distributor'));

module.exports = router;