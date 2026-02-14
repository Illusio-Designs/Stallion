const express = require('express');
const router = express.Router();
const salesmanExpenseController = require('../controllers/salesmanExpenseController');
const { authenticateToken } = require('../middleware/auth');
const { billUpload } = require('../constants/multer');

router.get('/', authenticateToken, salesmanExpenseController.getSalesmanExpenses);
router.post('/', authenticateToken, salesmanExpenseController.createSalesmanExpense);
router.put('/:id', authenticateToken, salesmanExpenseController.updateSalesmanExpense);
router.delete('/:id', authenticateToken, salesmanExpenseController.deleteSalesmanExpense);
router.post('/upload-images', authenticateToken, billUpload, salesmanExpenseController.uploadImages);

module.exports = router;