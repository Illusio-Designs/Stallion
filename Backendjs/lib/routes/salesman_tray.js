const express = require('express');
const router = express.Router();
const salesmanTrayController = require('../controllers/salesmanTrayController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'tray_manager', 'sales_manager']);
router.post('/', authenticateToken, salesmanTrayController.getAssignedTrays);
router.post('/assign', authenticateToken, canWrite, salesmanTrayController.assignSalesmanTray);
router.delete('/:id', authenticateToken, canWrite, salesmanTrayController.unassignSalesmanTray);

module.exports = router;