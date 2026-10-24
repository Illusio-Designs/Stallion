// Country / state / city / zone lists return only active rows by default.
// Admin and office roles may ask for every row with ?include_inactive=true so the
// Manage page can show inactive items and switch them back on. Everyone else
// (salesman, distributor, party) always gets active rows only.
const { Op, literal } = require('sequelize');
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

// Switching a country, state or city off also hides everything under it from the
// normal lists (nothing is changed or deleted; switching it back on brings the
// rows back). Rows that were switched off themselves stay off. `level` is the
// kind of list being read: 'state' | 'city' | 'zone'.
const PARENTS = {
    state: ['country_id IN (SELECT id FROM countries WHERE is_active = 1)'],
    city: ['state_id IN (SELECT id FROM states WHERE is_active = 1 AND country_id IN (SELECT id FROM countries WHERE is_active = 1))'],
    zone: [
        'city_id IN (SELECT id FROM cities WHERE is_active = 1)',
        'state_id IN (SELECT id FROM states WHERE is_active = 1 AND country_id IN (SELECT id FROM countries WHERE is_active = 1))',
    ],
};

function withActiveParents(req, where, level) {
    if (wantsInactive(req)) return where;
    const parts = (PARENTS[level] || []).map((sql) => literal(sql));
    if (!parts.length) return where;
    return { [Op.and]: [where || {}, ...parts] };
}

module.exports = { wantsInactive, activeFilter, activeUpdate, withActiveParents };
