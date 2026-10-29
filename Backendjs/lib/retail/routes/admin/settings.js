const express = require('express');
const router = express.Router();

// Retail admin settings routes (login required, roles checked in ../index.js or per route). See API_CONTRACT.md
// Manager only. Secrets (tracking_secrets) are write-only: reads return them masked.

const { checkRole } = require('../../../middleware/roleAuth');
const { RETAIL_ADMIN_ROLES } = require('../roles');
const { ok, wrap, noStore, HttpError } = require('../../services/httpCatalog');
const { audit } = require('../../services/audit');
const { setSetting } = require('../../services/settings');
const { DEFAULT_SETTINGS, SECRET_KEYS, loadSettings } = require('../../services/catalog');

const managersOnly = checkRole(RETAIL_ADMIN_ROLES);
const MASK = '••••';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const bad = (msg) => { throw new HttpError(400, msg); };

// ---- small validators (return a clean value or throw 400) ----
const text = (v, label, max = 300) => {
    if (v === undefined || v === null) return '';
    if (typeof v !== 'string' && typeof v !== 'number') bad(`${label} must be text`);
    const s = String(v).trim();
    if (s.length > max) bad(`${label} is too long (max ${max} characters)`);
    return s;
};
const url = (v, label) => {
    const s = text(v, label, 500);
    if (s && !/^(https?:\/\/|\/)/i.test(s)) bad(`${label} must start with http://, https:// or /`);
    return s;
};
const flag = (v, label) => {
    if (v === true || v === 'true' || v === 1) return true;
    if (v === false || v === 'false' || v === 0) return false;
    return bad(`${label} must be true or false`);
};
const money = (v, label) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1000000) bad(`${label} must be a number of rupees, 0 or more`);
    return Math.round(n * 100) / 100;
};
const whole = (v, label, max) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > max) bad(`${label} must be a whole number from 0 to ${max}`);
    return n;
};
const list = (v, label, max) => {
    if (!Array.isArray(v)) bad(`${label} must be a list`);
    if (v.length > max) bad(`${label} can have at most ${max} entries`);
    return v;
};

const VALIDATORS = {
    store(v) {
        if (!isObj(v)) bad('store must be an object');
        const social = isObj(v.social) ? v.social : {};
        const email = text(v.email, 'Email', 200);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Email does not look right');
        return {
            name: text(v.name, 'Store name', 120) || DEFAULT_SETTINGS.store.name,
            tagline: text(v.tagline, 'Tagline', 200),
            logo_url: url(v.logo_url, 'Logo URL'),
            support_phone: text(v.support_phone, 'Support phone', 30),
            whatsapp: text(v.whatsapp, 'WhatsApp', 30),
            email,
            address: text(v.address, 'Address', 500),
            hours: text(v.hours, 'Hours', 200),
            site_url: (() => { const s = url(v.site_url, 'Site URL'); return /^https?:\/\//i.test(s) ? s.replace(/\/+$/, '') : ''; })(),
            social: { instagram: url(social.instagram, 'Instagram link'), facebook: url(social.facebook, 'Facebook link'), youtube: url(social.youtube, 'YouTube link') },
        };
    },
    banner(v) {
        if (!isObj(v)) bad('banner must be an object');
        return {
            headline: text(v.headline, 'Banner headline', 160), sub: text(v.sub, 'Banner text', 300), image: url(v.image, 'Banner image'),
            cta_label: text(v.cta_label, 'Button label', 40), cta_url: url(v.cta_url, 'Button link'),
        };
    },
    usps(v) {
        return list(v, 'Highlights', 8).map((u) => {
            if (!isObj(u)) bad('Each highlight needs a title and text');
            return { title: text(u.title, 'Highlight title', 60), text: text(u.text, 'Highlight text', 160) };
        }).filter((u) => u.title || u.text);
    },
    shipping(v) {
        if (!isObj(v)) bad('shipping must be an object');
        const zones = list(v.zones === undefined ? [] : v.zones, 'Zones', 50).map((z) => {
            if (!isObj(z)) bad('Each zone needs a name, states, days and charge');
            const days_min = whole(z.days_min, 'Zone minimum days', 60);
            const days_max = whole(z.days_max, 'Zone maximum days', 60);
            if (days_min > days_max) bad('Zone minimum days cannot be more than maximum days');
            const states = list(z.states === undefined ? [] : z.states, 'Zone states', 60).map((s) => text(s, 'State', 60)).filter(Boolean);
            return { name: text(z.name, 'Zone name', 80) || 'Zone', states, days_min, days_max, charge: money(z.charge, 'Zone charge') };
        });
        const pins = list(v.blocked_pincodes === undefined ? [] : v.blocked_pincodes, 'Blocked pincodes', 5000).map((p) => String(p).trim());
        if (pins.some((p) => !/^\d{6}$/.test(p))) bad('Blocked pincodes must be 6 digits each');
        return {
            free_over: money(v.free_over, 'Free shipping above'),
            cod_enabled: flag(v.cod_enabled, 'Cash on delivery'),
            cod_fee: money(v.cod_fee, 'Cash on delivery fee'),
            express_enabled: flag(v.express_enabled, 'Express delivery'),
            express_charge: money(v.express_charge, 'Express charge'),
            packing_days: whole(v.packing_days === undefined ? 1 : v.packing_days, 'Packing days', 30),
            zones,
            blocked_pincodes: [...new Set(pins)],
        };
    },
    // These ids are printed into storefront scripts, so only plain id characters are allowed.
    tracking(v) {
        if (!isObj(v)) bad('tracking must be an object');
        const id = (x, label) => {
            const s = text(x, label, 40);
            if (!/^[A-Za-z0-9_-]*$/.test(s)) bad(`${label} may only contain letters, numbers, - and _`);
            return s;
        };
        return { ga_id: id(v.ga_id, 'Google Analytics ID'), meta_pixel_id: id(v.meta_pixel_id, 'Meta pixel ID'), cookie_notice: v.cookie_notice === undefined ? true : flag(v.cookie_notice, 'Cookie notice') };
    },
    store_enabled: (v) => flag(v, 'Store enabled'),
};

// secrets: a field that still holds the mask (or is missing) keeps its stored value; anything else replaces it ('' clears).
function mergeSecrets(incoming, stored) {
    if (!isObj(incoming)) bad('tracking_secrets must be an object');
    const out = { ...DEFAULT_SETTINGS.tracking_secrets, ...(isObj(stored) ? stored : {}) };
    Object.keys(DEFAULT_SETTINGS.tracking_secrets).forEach((k) => {
        if (incoming[k] === undefined || (typeof incoming[k] === 'string' && incoming[k].startsWith(MASK))) return;
        const s = text(incoming[k], k, 500);
        if (/\s/.test(s)) bad(`${k} cannot contain spaces`);
        out[k] = s;
    });
    return out;
}

const maskValue = (v) => {
    const s = typeof v === 'string' ? v : '';
    return s ? `${MASK}${s.length > 6 ? s.slice(-4) : ''}` : '';
};
function maskSecrets(obj) {
    const out = {};
    Object.keys(DEFAULT_SETTINGS.tracking_secrets).forEach((k) => { out[k] = maskValue(obj && obj[k]); });
    return out;
}

async function readAll() {
    const all = await loadSettings();
    SECRET_KEYS.forEach((k) => { all[k] = maskSecrets(all[k]); });
    return all;
}

router.use(['/settings'], noStore, managersOnly);

router.get('/settings', wrap(async (_req, res) => {
    ok(res, await readAll());
}));

// Partial update: send only the keys you want to change. Each key's value replaces the stored one (secrets merge per field).
router.put('/settings', wrap(async (req, res) => {
    const body = req.body;
    if (!isObj(body) || !Object.keys(body).length) throw new HttpError(400, 'Send the settings to change as an object');
    const unknown = Object.keys(body).filter((k) => !(k in DEFAULT_SETTINGS));
    if (unknown.length) throw new HttpError(400, `Unknown setting: ${unknown.join(', ')}`);

    // validate everything first so a bad value saves nothing
    const clean = {};
    for (const [key, value] of Object.entries(body)) {
        if (SECRET_KEYS.includes(key)) {
            // eslint-disable-next-line no-await-in-loop
            const stored = (await loadSettings([key]))[key];
            clean[key] = mergeSecrets(value, stored);
        } else {
            clean[key] = VALIDATORS[key](value);
        }
    }
    for (const [key, value] of Object.entries(clean)) {
        // eslint-disable-next-line no-await-in-loop
        await setSetting(key, value, { secret: SECRET_KEYS.includes(key) });
    }
    // keys only: values may be secrets
    await audit(req, 'update', 'retail_settings', null, `Retail: changed settings ${Object.keys(clean).join(', ')}`);
    ok(res, await readAll());
}));

module.exports = router;
