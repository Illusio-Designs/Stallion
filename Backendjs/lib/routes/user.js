const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { profileUpload } = require('../constants/multer');
const { authenticateToken } = require('../middleware/auth');

router.get('/', userController.getUsers);
router.get('/me', authenticateToken, userController.getMe);
router.put('/', authenticateToken, userController.updateUser);
router.delete('/', authenticateToken, userController.deleteUser);

// 📸 Profile Image Upload (requires auth)
router.post('/upload-profile', authenticateToken, profileUpload, userController.uploadProfileImage);

module.exports = router;