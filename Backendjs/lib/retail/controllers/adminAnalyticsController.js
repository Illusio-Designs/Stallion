// Admin: store analytics. Thin controller over services/analyticsService.js.
const { ok } = require('../services/http');
const analytics = require('../services/analyticsService');

async function summary(req, res) {
    ok(res, await analytics.summary(req.query.days));
}

module.exports = { summary };
