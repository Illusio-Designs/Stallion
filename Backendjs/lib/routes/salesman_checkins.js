const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const salesmanCheckInsController = require('../controllers/salesmanCheckInsController');

router.post('/', authenticateToken, salesmanCheckInsController.createSalesmanCheckIn);
router.get('/', authenticateToken, salesmanCheckInsController.getSalesmanCheckIns);
router.get('/:salesman_id', authenticateToken, salesmanCheckInsController.getSalesmanCheckInsBySalesmanId);
router.put('/:id', authenticateToken, salesmanCheckInsController.updateSalesmanCheckIn);
router.delete('/:id', authenticateToken, salesmanCheckInsController.deleteSalesmanCheckIn);

module.exports = router;