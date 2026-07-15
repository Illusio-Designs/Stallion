const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');
const dataWipeController = require('../controllers/dataWipeController');

// DESTRUCTIVE: wipe all test/transactional data + related upload files in one go.
// Admin-only, and additionally requires an exact confirmation phrase in the body:
//   POST /api/admin/wipe-data   body: { "confirm": "WIPE ALL DATA" }
router.post('/wipe-data', authenticateToken, isAdmin, dataWipeController.wipeData);

module.exports = router;
