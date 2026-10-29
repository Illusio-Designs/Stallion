const express = require('express');
const router = express.Router();
const { route } = require('../../services/http');
const ctrl = require('../../controllers/adminAnalyticsController');

// Retail admin analytics routes (login + retail role are checked in ../index.js). See API_CONTRACT.md
router.get('/analytics/summary', route(ctrl.summary));

module.exports = router;
