const express = require('express');
const router = express.Router();
const frameMaterialController = require('../controllers/frameMaterialController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, frameMaterialController.getFrameMaterials);
router.get('/:id', authenticateToken, frameMaterialController.getFrameMaterialById);
router.post('/', authenticateToken, canWrite, frameMaterialController.createFrameMaterial);
router.put('/:id', authenticateToken, canWrite, frameMaterialController.updateFrameMaterial);
router.delete('/:id', authenticateToken, canWrite, frameMaterialController.deleteFrameMaterial);

module.exports = router;