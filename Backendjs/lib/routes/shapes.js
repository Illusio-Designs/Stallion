const express = require('express');
const router = express.Router();
const shapesController = require('../controllers/shapesController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, shapesController.getShapes);
router.post('/', authenticateToken, shapesController.createShape);
router.put('/:id', authenticateToken, shapesController.updateShape);
router.delete('/:id', authenticateToken, shapesController.deleteShape);

module.exports = router;