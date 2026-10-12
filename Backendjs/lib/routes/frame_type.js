const express = require('express');
const router = express.Router();
const frameTypeController = require('../controllers/frameTypeController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, frameTypeController.getFrameTypes);
router.get('/:id', authenticateToken, frameTypeController.getFrameTypeById);
router.post('/', authenticateToken, canWrite, frameTypeController.createFrameType);
router.put('/:id', authenticateToken, canWrite, frameTypeController.updateFrameType);
router.delete('/:id', authenticateToken, canWrite, frameTypeController.deleteFrameType);

module.exports = router;