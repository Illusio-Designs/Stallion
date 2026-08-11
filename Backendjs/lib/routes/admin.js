const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleAuth');
const dataWipeController = require('../controllers/dataWipeController');

// DESTRUCTIVE: wipe all test/transactional data + related upload files in one go.
// Admin-only, and additionally requires an exact confirmation phrase in the body:
//   POST /api/admin/wipe-data   body: { "confirm": "WIPE ALL DATA" }
router.post('/wipe-data', authenticateToken, isAdmin, dataWipeController.wipeData);

// DESTRUCTIVE: delete all parties (+ their login accounts and upload files) only.
//   POST /api/admin/delete-all-parties   body: { "confirm": "WIPE ALL DATA" }
router.post('/delete-all-parties', authenticateToken, isAdmin, dataWipeController.deleteAllParties);

module.exports = router;
