const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');


router.post('/verify-otp', authController.verifyOtp);
router.post('/send-otp', authController.sendOtp);

// Logout route
router.post('/logout', authController.logout);

// Refresh token route
router.post('/refresh-token', authController.refreshToken);

router.post('/check-user', authController.checkUser);

router.post('/login', authController.login);

router.post('/register', authController.register);

module.exports = router;