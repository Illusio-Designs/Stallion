

const express = require('express');
const router = express.Router();
const cityController = require('../controllers/cityController');
const { authenticateToken } = require('../middleware/auth');

router.get('/:id', authenticateToken, cityController.getCityById);
router.post('/get', authenticateToken, cityController.getCities);
router.post('/', authenticateToken, cityController.createCity);
router.put('/:id', authenticateToken, cityController.updateCity);
router.delete('/:id', authenticateToken, cityController.deleteCity);

module.exports = router;