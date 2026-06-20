const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { profileUpload } = require('../constants/multer');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');

router.get('/', authenticateToken, isAdmin, userController.getUsers);
router.get('/me', authenticateToken, userController.getMe);
router.post('/', authenticateToken, isAdmin, userController.createUser);
router.put('/', authenticateToken, userController.updateUser);
router.put('/:id', authenticateToken, isAdmin, userController.updateUserById);
router.delete('/:id', authenticateToken, isAdmin, userController.deleteUser);
router.get('/role', authenticateToken, userController.getUserRole);
router.post('/upload-profile', authenticateToken, profileUpload, userController.uploadProfileImage);

module.exports = router;
