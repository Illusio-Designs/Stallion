const express = require('express');
const router = express.Router();
const genderController = require('../controllers/genderController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, genderController.getGenders);
router.get('/:id', authenticateToken, genderController.getGenderById);
router.post('/', authenticateToken, genderController.createGender);
router.put('/:id', authenticateToken, genderController.updateGender);
router.delete('/:id', authenticateToken, genderController.deleteGender);

module.exports = router;