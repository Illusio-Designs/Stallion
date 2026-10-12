const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, brandController.getBrands);
router.post('/', authenticateToken, canWrite, brandController.createBrand);
router.put('/:id', authenticateToken, canWrite, brandController.updateBrand);
router.delete('/:id', authenticateToken, canWrite, brandController.deleteBrand);

module.exports = router;