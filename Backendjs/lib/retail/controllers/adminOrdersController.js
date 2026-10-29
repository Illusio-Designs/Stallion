// Admin: orders and contact messages. Thin controllers over services/orderService.js and messageService.js.
const { ok } = require('../services/http');
const orders = require('../services/orderService');
const messages = require('../services/messageService');
const { parsePaginationParams, buildPaginatedResponse } = require('../../utils/listSearchHelpers');

const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

// { rows, total, page, limit } -> contract list envelope
const sendList = (res, { rows, total, page, limit }) => {
    const { data, pagination } = buildPaginatedResponse(rows, { page, limit }, total);
    return ok(res, data, 200, { pagination });
};

async function list(req, res) {
    const { status, q, from, to } = req.query;
    sendList(res, await orders.listOrders({ status, q, from, to, ...parsePaginationParams(req) }));
}

async function summary(req, res) { ok(res, await orders.summary()); }
async function detail(req, res) { ok(res, await orders.getOrder(req.params.id)); }
async function setStatus(req, res) { ok(res, await orders.changeStatus(req.params.id, body(req), req)); }
async function setShipping(req, res) { ok(res, await orders.updateShipping(req.params.id, body(req), req)); }

async function listMessages(req, res) {
    sendList(res, await messages.listMessages({ handled: req.query.handled, ...parsePaginationParams(req) }));
}
async function markMessage(req, res) { ok(res, await messages.setHandled(req.params.id, body(req).handled, req.user)); }

module.exports = { list, summary, detail, setStatus, setShipping, listMessages, markMessage };
