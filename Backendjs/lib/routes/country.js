const express = require('express');
const router = express.Router();
const countryController = require('../controllers/countryController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, countryController.getCountries);
router.get('/:id', authenticateToken, countryController.getCountryById);
router.post('/', authenticateToken, countryController.createCountry);
router.put('/:id', authenticateToken, countryController.updateCountry);
router.delete('/:id', authenticateToken, countryController.deleteCountry);

module.exports = router;