const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');

router.get('/my', authenticateToken, orderController.getMyOrders);
router.get('/', authenticateToken, orderController.getOrders);
router.post('/', authenticateToken, orderController.createOrder);
router.put('/:id', authenticateToken, orderController.updateOrderStatus);
router.delete('/:id', authenticateToken, orderController.deleteOrder);


module.exports = router;