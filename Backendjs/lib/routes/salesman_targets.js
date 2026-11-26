const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'sales_manager']);
const salesmanTargetsController = require('../controllers/salesmanTargetsController');

router.post('/', authenticateToken, canWrite, salesmanTargetsController.createSalesmanTarget);
router.get('/', authenticateToken, salesmanTargetsController.getSalesmanTargets);
router.get('/:salesman_id', authenticateToken, salesmanTargetsController.getSalesmanTargetsBySalesmanId);
router.put('/:id', authenticateToken, canWrite, salesmanTargetsController.updateSalesmanTarget);
router.delete('/:id', authenticateToken, noDelete('A target'));

module.exports = router;