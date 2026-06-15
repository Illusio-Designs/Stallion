const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const salesmanTargetsController = require('../controllers/salesmanTargetsController');

router.post('/', authenticateToken, salesmanTargetsController.createSalesmanTarget);
router.get('/', authenticateToken, salesmanTargetsController.getSalesmanTargets);
router.get('/:salesman_id', authenticateToken, salesmanTargetsController.getSalesmanTargetsBySalesmanId);
router.put('/:id', authenticateToken, salesmanTargetsController.updateSalesmanTarget);
router.delete('/:id', authenticateToken, salesmanTargetsController.deleteSalesmanTarget);

module.exports = router;