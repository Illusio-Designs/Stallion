const express = require('express');
const router = express.Router();
const salesmanController = require('../controllers/salesmanController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'sales_manager']);
const { salesmanDocsUpload } = require('../constants/multer');

router.get('/', authenticateToken, salesmanController.getSalesman);
router.get('/by-state/:stateId', authenticateToken, salesmanController.getSalesmenByState);
router.get('/:id', authenticateToken, salesmanController.getSalesmanById);
router.post('/get', authenticateToken, salesmanController.getSalesmen);
router.post('/', authenticateToken, canWrite, salesmanDocsUpload, salesmanController.createSalesman);
router.put('/:id', authenticateToken, canWrite, salesmanDocsUpload, salesmanController.updateSalesman);
router.delete('/:id', authenticateToken, canWrite, salesmanController.deleteSalesman);

module.exports = router;