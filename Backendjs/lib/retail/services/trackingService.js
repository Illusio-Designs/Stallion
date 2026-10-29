// Storefront tracking pings (visits and funnel events). These must never break a page: callers swallow errors.
const { Op } = require('sequelize');
const RetailVisit = require('../models/RetailVisit');
const RetailEvent = require('../models/RetailEvent');
const { cleanText, cleanPath, cleanReferrer, isSessionId, isUuid, resolveSource } = require('./validators');

const EVENT_TYPES = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];
const VISIT_WINDOW_MS = 30 * 60 * 1000; // a session counts as one visit for 30 minutes

// Returns true when a row was saved, false when the ping was invalid or a repeat.
async function recordVisit(body) {
    if (!isSessionId(body.session_id)) return false;
    const sessionId = body.session_id;

    const recent = await RetailVisit.findOne({
        where: { session_id: sessionId, created_at: { [Op.gte]: new Date(Date.now() - VISIT_WINDOW_MS) } },
        attributes: ['id'],
    });
    if (recent) return false;

    const referrer = cleanReferrer(body.referrer);
    const utmSource = cleanText(body.utm_source, 150);
    await RetailVisit.create({
        session_id: sessionId,
        landing_page: cleanPath(body.landing_page),
        referrer,
        source: resolveSource(utmSource, referrer),
        utm_source: utmSource,
        utm_medium: cleanText(body.utm_medium, 150),
        utm_campaign: cleanText(body.utm_campaign, 150),
        utm_term: cleanText(body.utm_term, 150),
        utm_content: cleanText(body.utm_content, 150),
    });
    return true;
}

async function recordEvent(body) {
    if (!isSessionId(body.session_id) || !EVENT_TYPES.includes(body.type)) return false;
    const value = Number(body.value);
    await RetailEvent.create({
        session_id: body.session_id,
        type: body.type,
        product_id: isUuid(body.product_id) ? body.product_id.toLowerCase() : null,
        value: Number.isFinite(value) && value >= 0 && value < 1e8 ? Math.round(value * 100) / 100 : null,
    });
    return true;
}

module.exports = { recordVisit, recordEvent, EVENT_TYPES };
