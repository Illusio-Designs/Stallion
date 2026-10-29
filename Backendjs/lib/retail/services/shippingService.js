// Shipping and COD rules, read from the `shipping` setting (see API_CONTRACT.md). Every value has a safe default
// so the store works before anyone opens the settings screen.
const State = require('../../models/State');
const { getSetting } = require('./settings');
const { addDeliveryDays } = require('./istTime');
const { toPaise, fromPaise, normalizePincode, isValidPincode } = require('./validators');

const DEFAULTS = {
    free_over: 1999,          // standard shipping is free from this subtotal; 0 switches free shipping off
    standard_charge: 60,      // standard fee when no zone matches (a matching zone's `charge` replaces it)
    express_enabled: true,
    express_charge: 120,
    cod_enabled: true,
    cod_fee: 40,
    packing_days: 1,
    days_min: 3,              // standard transit days when no zone matches
    days_max: 6,
};

const num = (v, fallback) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// The effective shipping config: stored values over defaults, with bad or missing entries ignored.
async function getShippingConfig() {
    const raw = (await getSetting('shipping', {})) || {};
    const s = typeof raw === 'object' ? raw : {};
    return {
        free_over: num(s.free_over, DEFAULTS.free_over),
        standard_charge: num(s.standard_charge, DEFAULTS.standard_charge),
        express_enabled: bool(s.express_enabled, DEFAULTS.express_enabled),
        express_charge: num(s.express_charge, DEFAULTS.express_charge),
        cod_enabled: bool(s.cod_enabled, DEFAULTS.cod_enabled),
        cod_fee: num(s.cod_fee, DEFAULTS.cod_fee),
        packing_days: Math.floor(num(s.packing_days, DEFAULTS.packing_days)),
        zones: Array.isArray(s.zones) ? s.zones.filter((z) => z && typeof z === 'object') : [],
        blocked_pincodes: new Set((Array.isArray(s.blocked_pincodes) ? s.blocked_pincodes : []).map((p) => normalizePincode(p))),
    };
}

// Stallion's own `states` table is the list of states (name + code); retail only reads it.
// Cached for a few minutes: the list almost never changes and every quote needs it.
let statesCache = { at: 0, rows: [] };
async function loadStates() {
    if (Date.now() - statesCache.at < 5 * 60 * 1000) return statesCache.rows;
    let rows = [];
    try {
        rows = (await State.findAll({ where: { is_active: true }, attributes: ['name', 'code'], raw: true }));
    } catch (err) {
        console.error('[retail] could not read states table:', err.message); // fall back to free text below
    }
    statesCache = { at: Date.now(), rows };
    return rows;
}

/**
 * Match what the customer typed or picked ("maharashtra", "MH") to a row of the `states` table.
 * Returns { name, code } with the official spelling, null when the input is empty, and { name: input, code: null,
 * known: false } when the table has no such state (or is empty) so a shop whose states are not loaded still works.
 * `tableFilled` tells checkout whether an unknown state should be refused.
 */
async function resolveState(input) {
    const raw = String(input == null ? '' : input).trim();
    if (!raw) return null;
    const key = raw.toLowerCase();
    const rows = await loadStates();
    const hit = rows.find((r) => String(r.name).toLowerCase() === key || (r.code && String(r.code).toLowerCase() === key));
    if (hit) return { name: hit.name, code: hit.code, known: true };
    return { name: raw.slice(0, 100), code: null, known: false, tableFilled: rows.length > 0 };
}

// Zone for a state: a zone that lists the state (by name or code, case-insensitive) wins; otherwise the first
// catch-all zone (empty or missing `states` = all states, e.g. 'All India'); otherwise null (default rates).
function findZone(config, state) {
    const keys = state ? [state.name, state.code].filter(Boolean).map((x) => String(x).trim().toLowerCase()) : [];
    const listed = (z) => Array.isArray(z.states) && z.states.length > 0;
    return config.zones.find((z) => listed(z) && z.states.some((x) => keys.includes(String(x).trim().toLowerCase())))
        || config.zones.find((z) => !listed(z))
        || null;
}

const isBlocked = (config, pincode) => config.blocked_pincodes.has(pincode);

// The delivery options for a cart: [{ id, name, days_min, days_max, charge, free }].
function buildOptions(config, { subtotalPaise, state }) {
    const zone = findZone(config, state);
    const pack = config.packing_days;
    const stdMin = Math.max(1, Math.floor(num(zone && zone.days_min, DEFAULTS.days_min))) + pack;
    const stdMax = Math.max(stdMin, Math.floor(num(zone && zone.days_max, DEFAULTS.days_max)) + pack);

    const stdPaise = toPaise(num(zone && zone.charge, config.standard_charge));
    const freeStd = config.free_over > 0 && subtotalPaise >= toPaise(config.free_over);
    const options = [{
        id: 'standard',
        name: 'Standard delivery',
        days_min: stdMin,
        days_max: stdMax,
        charge: freeStd ? 0 : fromPaise(stdPaise),
        free: freeStd || stdPaise === 0,
    }];

    if (config.express_enabled) {
        const expMax = Math.min(stdMax, 3 + pack);
        const expMin = Math.min(expMax, 1 + pack);
        const expPaise = toPaise(config.express_charge);
        options.push({
            id: 'express',
            name: 'Express delivery',
            days_min: expMin,
            days_max: expMax,
            charge: fromPaise(expPaise),
            free: expPaise === 0,
        });
    }
    return options;
}

/**
 * POST /shipping/check. `subtotal` is only used for the free-shipping rule; `state` (optional) picks a zone.
 */
async function checkShipping({ pincode, subtotal, state }) {
    const config = await getShippingConfig();
    const stateInfo = await resolveState(state);
    const pin = normalizePincode(pincode);
    const subtotalPaise = Math.max(0, toPaise(subtotal) || 0);
    const serviceable = isValidPincode(pin) && !isBlocked(config, pin);
    if (!serviceable) {
        return { serviceable: false, cod_available: false, estimate_days_min: null, estimate_days_max: null, estimate_date: null, options: [] };
    }
    const options = buildOptions(config, { subtotalPaise, state: stateInfo });
    const standard = options[0];
    return {
        serviceable: true,
        cod_available: config.cod_enabled,
        estimate_days_min: standard.days_min,
        estimate_days_max: standard.days_max,
        estimate_date: addDeliveryDays(standard.days_max),
        options,
    };
}

/**
 * Fees for a cart, in paise. Throws a plain Error with `.code` set when the choice is not possible:
 *  unserviceable (bad or blocked pincode), express_disabled, cod_disabled.
 * Without a pincode (cart page, before the address) the default rates are used.
 */
function computeFees(config, { pincode, state, subtotalPaise, shippingOption, paymentType }) {
    const fail = (code, message) => Object.assign(new Error(message), { code });
    const pin = normalizePincode(pincode);
    if (pin && (!isValidPincode(pin) || isBlocked(config, pin))) {
        throw fail('unserviceable', 'Sorry, we do not deliver to this pincode yet.');
    }
    const options = buildOptions(config, { subtotalPaise, state });
    const option = options.find((o) => o.id === shippingOption);
    if (!option) throw fail('express_disabled', 'Express delivery is not available right now.');
    if (paymentType === 'cod' && !config.cod_enabled) throw fail('cod_disabled', 'Cash on delivery is not available right now.');
    return {
        option,
        shippingPaise: toPaise(option.charge),
        codPaise: paymentType === 'cod' ? toPaise(config.cod_fee) : 0,
        expectedDelivery: addDeliveryDays(option.days_max),
    };
}

module.exports = { getShippingConfig, checkShipping, computeFees, resolveState };
