const express = require('express');
const router = express.Router();
const trayProductsController = require('../controllers/trayProductsController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'tray_manager']);
router.get('/:id', authenticateToken, trayProductsController.getProductsInTray);
router.post('/', authenticateToken, canWrite, trayProductsController.addProductToTray);
router.put('/', authenticateToken, canWrite, trayProductsController.updateProductInTray);
router.delete('/', authenticateToken, canWrite, trayProductsController.deleteProductFromTray);

module.exports = router;