const express = require('express');
const router = express.Router();
const trayProductsController = require('../controllers/trayProductsController');
const { authenticateToken } = require('../middleware/auth');

router.get('/:id', authenticateToken, trayProductsController.getProductsInTray);
router.post('/', authenticateToken, trayProductsController.addProductToTray);
router.put('/', authenticateToken, trayProductsController.updateProductInTray);
router.delete('/', authenticateToken, trayProductsController.deleteProductFromTray);

module.exports = router;