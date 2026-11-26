const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', collectionController.getCollections);
router.post('/', authenticateToken, canWrite, collectionController.createCollection);
router.put('/:id', authenticateToken, canWrite, collectionController.updateCollection);
router.delete('/:id', authenticateToken, noDelete('A collection'));

module.exports = router;