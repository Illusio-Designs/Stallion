const express = require('express');
const router = express.Router();
const stateController = require('../controllers/stateController');
const { authenticateToken } = require('../middleware/auth');

router.get('/:id', authenticateToken, stateController.getStateById);
router.post('/get', authenticateToken, stateController.getStates);
router.post('/', authenticateToken, stateController.createState);
router.put('/:id', authenticateToken, stateController.updateState);
router.delete('/:id', authenticateToken, stateController.deleteState);

module.exports = router;