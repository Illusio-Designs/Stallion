const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');

router.get('/my', authenticateToken, orderController.getMyOrders);
router.get('/sales-by-state', authenticateToken, orderController.getSalesByState);
router.get('/', authenticateToken, orderController.getOrders);
router.post('/quote', authenticateToken, orderController.quoteOrder);
router.post('/', authenticateToken, orderController.createOrder);
router.put('/:id', authenticateToken, orderController.updateOrderStatus);
router.post('/:id/dispatch', authenticateToken, orderController.dispatchOrder);
router.post('/:id/trays-returned', authenticateToken, orderController.traysReturned);
router.post('/:id/complete', authenticateToken, orderController.completeOrder);
router.delete('/:id', authenticateToken, noDelete('An order'));


module.exports = router;