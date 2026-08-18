const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { isPartnerCreator } = require('../middleware/roleAuth');

router.post('/verify-otp', authController.verifyOtp);
router.post('/verify-token', authController.verifyAccessToken);
router.post('/send-otp', authController.sendOtp);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/check-user', authController.checkUser);
router.get('/check-token', authenticateToken, authController.checkToken);
router.post('/login', authController.login);
router.post('/register', authenticateToken, isPartnerCreator, authController.register);

module.exports = router;
