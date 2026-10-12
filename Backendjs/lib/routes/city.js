

const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin']);
router.get('/:id', authenticateToken, cityController.getCityById);
router.post('/get', authenticateToken, cityController.getCities);
router.post('/', authenticateToken, canWrite, cityController.createCity);
router.put('/:id', authenticateToken, canWrite, cityController.updateCity);
router.delete('/:id', authenticateToken, canWrite, cityController.deleteCity);

module.exports = router;