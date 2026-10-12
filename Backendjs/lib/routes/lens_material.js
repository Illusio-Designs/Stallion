const express = require('express');
const router = express.Router();
const lensMaterialController = require('../controllers/lensMaterialController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, lensMaterialController.getLensMaterials);
router.get('/:id', authenticateToken, lensMaterialController.getLensMaterialById);
router.post('/', authenticateToken, canWrite, lensMaterialController.createLensMaterial);
router.put('/:id', authenticateToken, canWrite, lensMaterialController.updateLensMaterial);
router.delete('/:id', authenticateToken, canWrite, lensMaterialController.deleteLensMaterial);

module.exports = router;