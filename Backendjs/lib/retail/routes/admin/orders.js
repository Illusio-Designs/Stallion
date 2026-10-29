const express = require('express');
const router = express.Router();
const { checkRole } = require('../../../middleware/roleAuth');
const { RETAIL_ADMIN_ROLES } = require('../roles');
const { route } = require('../../services/http');
const ctrl = require('../../controllers/adminOrdersController');

// Retail admin orders and messages (login + retail role are checked in ../index.js; managers only here). See API_CONTRACT.md
const managers = checkRole(RETAIL_ADMIN_ROLES);

router.get('/orders', managers, route(ctrl.list));
router.get('/orders/summary', managers, route(ctrl.summary)); // before /orders/:id
router.get('/orders/:id', managers, route(ctrl.detail));
router.put('/orders/:id/status', managers, route(ctrl.setStatus));
router.put('/orders/:id/shipping', managers, route(ctrl.setShipping));

router.get('/messages', managers, route(ctrl.listMessages));
router.put('/messages/:id', managers, route(ctrl.markMessage));

module.exports = router;
