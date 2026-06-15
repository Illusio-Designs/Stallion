const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', collectionController.getCollections);
router.post('/', authenticateToken, collectionController.createCollection);
router.put('/:id', authenticateToken, collectionController.updateCollection);
router.delete('/:id', authenticateToken, collectionController.deleteCollection);

module.exports = router;