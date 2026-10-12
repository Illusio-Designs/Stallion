const express = require('express');
const router = express.Router();
const colorCodesController = require('../controllers/colorCodesController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, colorCodesController.getColorCodes);
router.post('/', authenticateToken, canWrite, colorCodesController.createColorCode);
router.put('/:id', authenticateToken, canWrite, colorCodesController.updateColorCode);
router.delete('/:id', authenticateToken, canWrite, colorCodesController.deleteColorCode);

module.exports = router;