const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const rolesController = require('../controllers/rolesController');

router.get('/', authenticateToken, rolesController.getRoles);

module.exports = router;