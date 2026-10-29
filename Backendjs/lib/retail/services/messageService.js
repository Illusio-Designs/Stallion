// Contact form messages: saved from the public form, read and marked handled by the team.
const RetailMessage = require('../models/RetailMessage');
const { HttpError } = require('./http');
const { cleanText, normalizePhone, isValidPhone, isEmail, isUuid } = require('./validators');

async function createMessage(body) {
    const errors = {};
    const name = cleanText(body.name, 120);
    if (!name || name.length < 2) errors.name = 'Please enter your name.';
    const rawContact = cleanText(body.contact, 190);
    let contact = null;
    if (rawContact && isEmail(rawContact)) contact = rawContact.toLowerCase();
    else if (rawContact && isValidPhone(normalizePhone(rawContact))) contact = normalizePhone(rawContact);
    else errors.contact = 'Please enter a valid phone number or email address.';
    const message = cleanText(body.message, 2000);
    if (!message || message.length < 5) errors.message = 'Please write your message.';
    if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], { errors });

    await RetailMessage.create({ name, contact, message });
    return { ok: true };
}

const row = (m) => ({
    id: m.id, name: m.name, contact: m.contact, message: m.message,
    handled: m.handled, handled_at: m.handled_at ? m.handled_at.toISOString() : null, handled_by: m.handled_by,
    created_at: m.created_at.toISOString(),
});

async function listMessages({ handled, page, limit, offset }) {
    const where = {};
    if (handled === 'true') where.handled = true;
    else if (handled === 'false') where.handled = false;
    const { count, rows } = await RetailMessage.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'ASC']], limit, offset });
    return { rows: rows.map(row), total: count, page, limit };
}

async function setHandled(id, handled, user) {
    if (!isUuid(id)) throw new HttpError(404, 'Message not found.');
    if (typeof handled !== 'boolean') throw new HttpError(400, 'Send handled as true or false.');
    const m = await RetailMessage.findByPk(id);
    if (!m) throw new HttpError(404, 'Message not found.');
    await m.update({
        handled,
        handled_at: handled ? new Date() : null,
        handled_by: handled ? String((user && (user.full_name || user.email || user.phone)) || 'Admin').slice(0, 120) : null,
    });
    return row(m);
}

module.exports = { createMessage, listMessages, setHandled };
