const express = require('express');
const router = express.Router();
const salesmanController = require('../controllers/salesmanController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, salesmanController.getSalesman);
router.post('/get', authenticateToken, salesmanController.getSalesmen);
router.post('/', authenticateToken, salesmanController.createSalesman);
router.put('/:id', authenticateToken, salesmanController.updateSalesman);
router.delete('/:id', authenticateToken, salesmanController.deleteSalesman);

module.exports = router;