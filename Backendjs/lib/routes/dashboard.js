const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', authenticateToken, dashboardController.getSummary);
router.get('/my-salesman', authenticateToken, dashboardController.getMySalesman);

module.exports = router;
