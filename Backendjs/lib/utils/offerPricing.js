/**
 * Offer pricing — the single source of truth for how an offer discounts an order.
 * Used by the offers "available" endpoint, the order "quote" preview and the real
 * createOrder. All money is computed from WHP (the unit_price the caller passes).
 *
 * A `line` is: { product_id, qty, unit_price }  (gross = qty * unit_price)
 * Exactly ONE offer is ever applied to an order (the one the user selected).
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Is the offer switched on and within its active timeline? */
function isOfferActive(offer, now = new Date()) {
    if (!offer || offer.is_active === false) return false;
    const start = offer.start_date ? new Date(offer.start_date) : null;
    const end = offer.end_date ? new Date(offer.end_date) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
}

/** Normalise config which may arrive as a JSON string. */
function readConfig(offer) {
    const c = offer && offer.config;
    if (!c) return {};
    if (typeof c === 'string') {
        try { return JSON.parse(c); } catch { return {}; }
    }
    return c;
}

/** Does the offer's product scope touch the cart at all? (flat = always) */
function offerScopeMatches(offer, lines) {
    const cfg = readConfig(offer);
    const ids = new Set(lines.map((l) => String(l.product_id)));
    switch (offer.offer_type) {
        case 'flat':
            return true;
        case 'product':
            return Array.isArray(cfg.items) &&
                cfg.items.some((it) => ids.has(String(it.product_id)));
        case 'bogo':
            return Array.isArray(cfg.product_ids) &&
                cfg.product_ids.some((id) => ids.has(String(id)));
        default:
            return false;
    }
}

/**
 * Compute the discount this offer gives the cart.
 * Returns { discountTotal, lineDiscounts: { [product_id]: amount } }.
 * Per-line discount never exceeds the line gross; flat never exceeds subtotal.
 */
function computeOfferDiscount(offer, lines) {
    const cfg = readConfig(offer);
    const lineDiscounts = {};
    const grossOf = (l) => (Number(l.qty) || 0) * (Number(l.unit_price) || 0);

    if (offer.offer_type === 'flat') {
        const subtotal = lines.reduce((s, l) => s + grossOf(l), 0);
        const min = Number(cfg.min_order_amount) || 0;
        if (subtotal < min) return { discountTotal: 0, lineDiscounts };
        let d = cfg.discount_mode === 'percent'
            ? subtotal * (Number(cfg.discount_value) || 0) / 100
            : Math.min(Number(cfg.discount_value) || 0, subtotal);
        return { discountTotal: round2(Math.max(0, d)), lineDiscounts };
    }

    if (offer.offer_type === 'product') {
        const items = Array.isArray(cfg.items) ? cfg.items : [];
        let total = 0;
        for (const l of lines) {
            const item = items.find((it) => String(it.product_id) === String(l.product_id));
            if (!item) continue;
            const gross = grossOf(l);
            let ld = item.discount_mode === 'percent'
                ? gross * (Number(item.discount_value) || 0) / 100
                : Math.min((Number(item.discount_value) || 0) * (Number(l.qty) || 0), gross);
            ld = round2(Math.max(0, Math.min(ld, gross)));
            if (ld > 0) { lineDiscounts[l.product_id] = (lineDiscounts[l.product_id] || 0) + ld; total += ld; }
        }
        return { discountTotal: round2(total), lineDiscounts };
    }

    if (offer.offer_type === 'bogo') {
        const scope = new Set((cfg.product_ids || []).map(String));
        const buy = Math.max(1, Number(cfg.buy_qty) || 0);
        const get = Math.max(0, Number(cfg.get_qty) || 0);
        const getPct = cfg.get_discount_percent == null ? 100 : Number(cfg.get_discount_percent);
        const bundle = buy + get;
        let total = 0;
        if (get > 0 && bundle > 0) {
            for (const l of lines) {
                if (!scope.has(String(l.product_id))) continue;
                const freeUnits = Math.floor((Number(l.qty) || 0) / bundle) * get;
                if (freeUnits <= 0) continue;
                const gross = grossOf(l);
                let ld = round2(Math.min(freeUnits * (Number(l.unit_price) || 0) * (getPct / 100), gross));
                if (ld > 0) { lineDiscounts[l.product_id] = (lineDiscounts[l.product_id] || 0) + ld; total += ld; }
            }
        }
        return { discountTotal: round2(total), lineDiscounts };
    }

    return { discountTotal: 0, lineDiscounts };
}

/** Validate the config for a given offer_type. Returns null if OK, else a message. */
function validateOfferConfig(offer_type, config) {
    const cfg = config || {};
    const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
    if (offer_type === 'flat') {
        if (!['percent', 'amount'].includes(cfg.discount_mode)) return 'flat: discount_mode must be percent or amount';
        if (!isNum(cfg.discount_value) || cfg.discount_value <= 0) return 'flat: discount_value must be a positive number';
        if (cfg.discount_mode === 'percent' && cfg.discount_value > 100) return 'flat: percent discount cannot exceed 100';
        return null;
    }
    if (offer_type === 'product') {
        if (!Array.isArray(cfg.items) || cfg.items.length === 0) return 'product: items[] is required';
        for (const it of cfg.items) {
            if (!it.product_id) return 'product: each item needs a product_id';
            if (!['percent', 'amount'].includes(it.discount_mode)) return 'product: each item discount_mode must be percent or amount';
            if (!isNum(it.discount_value) || it.discount_value <= 0) return 'product: each item discount_value must be positive';
        }
        return null;
    }
    if (offer_type === 'bogo') {
        if (!Array.isArray(cfg.product_ids) || cfg.product_ids.length === 0) return 'bogo: product_ids[] is required';
        if (!isNum(cfg.buy_qty) || cfg.buy_qty <= 0) return 'bogo: buy_qty must be a positive number';
        if (!isNum(cfg.get_qty) || cfg.get_qty <= 0) return 'bogo: get_qty must be a positive number';
        return null;
    }
    return 'offer_type must be one of: flat, product, bogo';
}

module.exports = {
    round2,
    isOfferActive,
    readConfig,
    offerScopeMatches,
    computeOfferDiscount,
    validateOfferConfig,
};
