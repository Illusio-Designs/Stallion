const express = require('express');
const router = express.Router();
const { route, rateLimit } = require('../../services/http');
const ctrl = require('../../controllers/trackingController');

// Public (no login) tracking routes. See Backendjs/lib/retail/API_CONTRACT.md
// Pings from bots are ignored inside the controller; real visitors send a handful per session.
const pingLimit = rateLimit({ name: 'retail-ping', max: 120, windowMs: 60 * 1000 });

router.post('/track/visit', pingLimit, route(ctrl.visit));
router.post('/track/event', pingLimit, route(ctrl.event));

module.exports = router;
