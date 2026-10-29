// Public checkout endpoints. Thin: read the request, call a service, answer in the contract envelope.
const { ok, HttpError } = require('../services/http');
const { checkShipping } = require('../services/shippingService');
const { quote, createOrder, trackOrder } = require('../services/orderService');
const { createMessage } = require('../services/messageService');
const { normalizePincode, isValidPincode } = require('../services/validators');

const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

async function shippingCheck(req, res) {
    const b = body(req);
    const pincode = normalizePincode(b.pincode);
    if (!isValidPincode(pincode)) throw new HttpError(400, 'Please enter a valid 6-digit pincode.');
    ok(res, await checkShipping({ pincode, subtotal: b.subtotal, state: b.state }));
}

async function checkoutQuote(req, res) {
    ok(res, await quote(body(req)));
}

async function checkoutOrder(req, res) {
    ok(res, await createOrder(body(req)), 201);
}

async function orderTrack(req, res) {
    ok(res, await trackOrder(body(req)));
}

async function contact(req, res) {
    ok(res, await createMessage(body(req)), 201);
}

module.exports = { shippingCheck, checkoutQuote, checkoutOrder, orderTrack, contact };
