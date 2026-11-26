const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const stateController = require('../controllers/stateController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin']);
router.get('/:id', authenticateToken, stateController.getStateById);
router.post('/get', authenticateToken, stateController.getStates);
router.post('/', authenticateToken, canWrite, stateController.createState);
router.put('/:id', authenticateToken, canWrite, stateController.updateState);
router.delete('/:id', authenticateToken, noDelete('A state'));

module.exports = router;