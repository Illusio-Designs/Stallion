// Country / state / city / zone lists return only active rows by default.
// Admin and office roles may ask for every row with ?include_inactive=true so the
// Manage page can show inactive items and switch them back on. Everyone else
// (salesman, distributor, party) always gets active rows only.
const { isOfficeRole } = require('./roleHelpers');

function wantsInactive(req) {
    const raw = (req && req.query && req.query.include_inactive) ?? (req && req.body && req.body.include_inactive);
    const v = String(raw ?? '').toLowerCase();
    return (v === 'true' || v === '1') && isOfficeRole(req.userRoleNames || []);
}

function activeFilter(req) {
    return wantsInactive(req) ? {} : { is_active: true };
}

function activeUpdate(body) {
    if (!body || body.is_active === undefined || body.is_active === null) return {};
    const v = body.is_active;
    return { is_active: v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1' };
}

module.exports = { wantsInactive, activeFilter, activeUpdate };
