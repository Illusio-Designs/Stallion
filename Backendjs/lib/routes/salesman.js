const express = require('express');
const router = express.Router();
const salesmanController = require('../controllers/salesmanController');
const { authenticateToken } = require('../middleware/auth');
const { salesmanDocsUpload } = require('../constants/multer');

router.get('/', authenticateToken, salesmanController.getSalesman);
router.get('/by-state/:stateId', authenticateToken, salesmanController.getSalesmenByState);
router.get('/:id', authenticateToken, salesmanController.getSalesmanById);
router.post('/get', authenticateToken, salesmanController.getSalesmen);
router.post('/', authenticateToken, salesmanDocsUpload, salesmanController.createSalesman);
router.put('/:id', authenticateToken, salesmanController.updateSalesman);
router.delete('/:id', authenticateToken, salesmanController.deleteSalesman);

module.exports = router;