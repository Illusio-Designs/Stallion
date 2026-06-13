const express = require('express');
const router = express.Router();
const lensMaterialController = require('../controllers/lensMaterialController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, lensMaterialController.getLensMaterials);
router.get('/:id', authenticateToken, lensMaterialController.getLensMaterialById);
router.post('/', authenticateToken, lensMaterialController.createLensMaterial);
router.put('/:id', authenticateToken, lensMaterialController.updateLensMaterial);
router.delete('/:id', authenticateToken, lensMaterialController.deleteLensMaterial);

module.exports = router;