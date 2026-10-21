const express = require('express');
const noDelete = require('../middleware/noDelete');
const router = express.Router();
const genderController = require('../controllers/genderController');
const { authenticateToken } = require('../middleware/auth');

const { checkRole } = require('../middleware/roleAuth');
// Who may CHANGE this data. Reading stays open to any logged-in user because the
// dropdowns on many pages need it; writing is limited to the roles that manage it.
const canWrite = checkRole(['admin', 'product_manager']);
router.get('/', authenticateToken, genderController.getGenders);
router.get('/:id', authenticateToken, genderController.getGenderById);
router.post('/', authenticateToken, canWrite, genderController.createGender);
router.put('/:id', authenticateToken, canWrite, genderController.updateGender);
router.delete('/:id', authenticateToken, noDelete('A gender'));

module.exports = router;