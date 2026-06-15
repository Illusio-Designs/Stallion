const express = require('express');
const router = express.Router();
const colorCodesController = require('../controllers/colorCodesController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, colorCodesController.getColorCodes);
router.post('/', authenticateToken, colorCodesController.createColorCode);
router.put('/:id', authenticateToken, colorCodesController.updateColorCode);
router.delete('/:id', authenticateToken, colorCodesController.deleteColorCode);

module.exports = router;