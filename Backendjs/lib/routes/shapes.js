const express = require('express');
const router = express.Router();
const shapesController = require('../controllers/shapesController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, shapesController.getShapes);
router.post('/', authenticateToken, canWrite, shapesController.createShape);
router.put('/:id', authenticateToken, canWrite, shapesController.updateShape);
router.delete('/:id', authenticateToken, canWrite, shapesController.deleteShape);

module.exports = router;