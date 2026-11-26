// Shared helpers for the product attribute lists (brand, shape, gender ...).
// Items are never deleted; they are switched inactive. Pickers and shop filters
// call the list endpoints with ?active=true to get only the active items.
function activeOnlyWhere(req) {
    const v = String((req && req.query && req.query.active) ?? '').toLowerCase();
    return v === 'true' || v === '1' ? { is_active: true } : {};
}

function activeUpdate(body) {
    if (!body || body.is_active === undefined || body.is_active === null) return {};
    const v = body.is_active;
    return { is_active: v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v) === '1' };
}

module.exports = { activeOnlyWhere, activeUpdate };
