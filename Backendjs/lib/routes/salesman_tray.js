const express = require('express');
const router = express.Router();
const salesmanTrayController = require('../controllers/salesmanTrayController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, salesmanTrayController.getAssignedTrays);
router.post('/assign', authenticateToken, salesmanTrayController.assignSalesmanTray);
router.delete('/:id', authenticateToken, salesmanTrayController.unassignSalesmanTray);

module.exports = router;