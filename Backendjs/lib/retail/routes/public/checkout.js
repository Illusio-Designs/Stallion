const express = require('express');
const router = express.Router();
const { route, rateLimit, clientIp } = require('../../services/http');
const { normalizePhone } = require('../../services/validators');
const ctrl = require('../../controllers/checkoutController');

// Public (no login) checkout routes. See Backendjs/lib/retail/API_CONTRACT.md
// The shared 240/min per-IP limit is applied in ../index.js; these are the stricter limits for POSTs.

const MIN = 60 * 1000;
const phoneOf = (req) => normalizePhone(req.body && req.body.customer && req.body.customer.phone);

router.post('/shipping/check', rateLimit({ name: 'retail-ship', max: 60, windowMs: MIN }), route(ctrl.shippingCheck));
router.post('/checkout/quote', rateLimit({ name: 'retail-quote', max: 60, windowMs: MIN }), route(ctrl.checkoutQuote));

// Orders: per IP and per phone number, so one person (or script) cannot flood the shop with fake COD orders.
router.post('/checkout/orders', rateLimit({
    name: 'retail-order', max: 12, windowMs: 10 * MIN, keys: (req) => [clientIp(req), phoneOf(req) && `p${phoneOf(req)}`],
    message: 'Too many orders from this device. Please wait a few minutes or call us.',
}), route(ctrl.checkoutOrder));

// Tracking: also limited per order number, since order numbers are sequential and easy to guess.
router.post('/orders/track', rateLimit({
    name: 'retail-track', max: 20, windowMs: 15 * MIN,
    keys: (req) => [clientIp(req), req.body && typeof req.body.order_number === 'string' && `n${req.body.order_number.trim().toUpperCase().slice(0, 20)}`],
    message: 'Too many attempts. Please try again in a few minutes.',
}), route(ctrl.orderTrack));

router.post('/contact', rateLimit({ name: 'retail-contact', max: 5, windowMs: 60 * MIN, message: 'You have sent several messages already. Please try again later.' }), route(ctrl.contact));

module.exports = router;
