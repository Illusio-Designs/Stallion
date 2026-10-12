const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { isPartnerCreator } = require('../middleware/roleAuth');

// check-user is the first step of every login (and triggers a send), so it shares
// the per-phone / per-IP send limits. Resends go through /otp-request.
router.post('/otp-request', authController.otpRequest);
router.post('/verify-otp', authController.verifyOtp);
router.post('/verify-token', authController.verifyAccessToken);
router.post('/send-otp', (req, res, next) => authController.otpGate(req, res, next), authController.sendOtp);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/check-user', (req, res, next) => authController.otpGate(req, res, next), authController.checkUser);
router.get('/check-token', authenticateToken, authController.checkToken);
router.post('/login', authController.login);
router.post('/register', authenticateToken, isPartnerCreator, authController.register);

module.exports = router;
