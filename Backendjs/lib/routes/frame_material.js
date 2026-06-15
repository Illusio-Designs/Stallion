const express = require('express');
const router = express.Router();
const frameMaterialController = require('../controllers/frameMaterialController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, frameMaterialController.getFrameMaterials);
router.get('/:id', authenticateToken, frameMaterialController.getFrameMaterialById);
router.post('/', authenticateToken, frameMaterialController.createFrameMaterial);
router.put('/:id', authenticateToken, frameMaterialController.updateFrameMaterial);
router.delete('/:id', authenticateToken, frameMaterialController.deleteFrameMaterial);

module.exports = router;