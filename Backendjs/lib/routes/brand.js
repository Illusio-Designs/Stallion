const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, brandController.getBrands);
router.post('/', authenticateToken, brandController.createBrand);
router.put('/:id', authenticateToken, brandController.updateBrand);
router.delete('/:id', authenticateToken, brandController.deleteBrand);

module.exports = router;