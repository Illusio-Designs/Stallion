// Storefront tracking pings. They never fail the page: bots, bad input and database trouble all answer 200.
const { ok } = require('../services/http');
const { isBot } = require('../services/validators');
const { recordVisit, recordEvent } = require('../services/trackingService');

// sendBeacon may post JSON as text/plain, which the JSON parser leaves as a string.
function pingBody(req) {
    const b = req.body;
    if (b && typeof b === 'object') return b;
    if (typeof b === 'string') { try { return JSON.parse(b) || {}; } catch (_e) { return {}; } }
    return {};
}

const ping = (record) => async (req, res) => {
    if (!isBot(req.headers['user-agent'])) {
        try {
            await record(pingBody(req));
        } catch (err) {
            console.error('[retail] tracking ping not saved:', err.message);
        }
    }
    ok(res, { ok: true });
};

module.exports = { visit: ping(recordVisit), event: ping(recordEvent) };
