const express = require('express');
const router = express.Router();
const countryController = require('../controllers/countryController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin']);
router.get('/', authenticateToken, countryController.getCountries);
router.get('/:id', authenticateToken, countryController.getCountryById);
router.post('/', authenticateToken, canWrite, countryController.createCountry);
router.put('/:id', authenticateToken, canWrite, countryController.updateCountry);
router.delete('/:id', authenticateToken, canWrite, countryController.deleteCountry);

module.exports = router;