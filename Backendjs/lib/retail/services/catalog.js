// Shared helpers for the catalogue and content routes: what "visible on the store" means, how a frame is
// shaped for the public API (never any wholesale field), slugs, site URLs and the settings defaults.
const { Op } = require('sequelize');
const RetailProduct = require('../models/RetailProduct');
const RetailContent = require('../models/RetailContent');
const { getSettings } = require('./settings');
const { sanitizeHtml, htmlToText } = require('./sanitizeHtml');

// A frame is on the store only when the admin switched it on, it is active and there is stock.
const VISIBLE = () => ({ show_on_store: true, is_active: true, stock: { [Op.gt]: 0 } });
const LOW_STOCK_AT = 5;

// Public columns only. (RetailProduct has no wholesale fields, but we still list columns explicitly.)
const CARD_ATTRS = ['id', 'slug', 'model_no', 'title', 'brand_name', 'mrp', 'stock', 'shape', 'frame_material', 'color', 'images'];

const parseJson = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch (_e) { return fallback; }
};

// Image list: only http(s) or site-relative strings.
const imageList = (v) => {
    const arr = parseJson(v, []);
    return (Array.isArray(arr) ? arr : []).filter((u) => typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u));
};

const displayTitle = (p) => (p.title && p.title.trim()) || [p.brand_name, p.model_no].filter(Boolean).join(' ').trim() || p.model_no;

function toCard(p) {
    const stock = Number(p.stock) || 0;
    return {
        id: p.id,
        slug: p.slug,
        model_no: p.model_no,
        title: displayTitle(p),
        image: imageList(p.images)[0] || null,
        mrp: Number(p.mrp) || 0,
        stock,
        low_stock: stock <= LOW_STOCK_AT,
        shape: p.shape || null,
        frame_material: p.frame_material || null,
        color: p.color || null,
    };
}

// Cards for a list of ids, in the same order, skipping frames that are not visible.
async function cardsByIds(ids) {
    const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === 'string').slice(0, 24);
    if (!list.length) return [];
    const rows = await RetailProduct.findAll({ where: { id: list, ...VISIBLE() }, attributes: CARD_ATTRS });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return list.map((id) => byId.get(id)).filter(Boolean).map(toCard);
}

function slugify(input, max = 120) {
    const s = String(input || '')
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/g, '');
    return s || 'item';
}

// First free slug: base, base-2, base-3 ... (checked against the given model's `slug` column).
async function uniqueSlug(Model, base, excludeId = null) {
    for (let n = 1; n <= 200; n += 1) {
        const candidate = n === 1 ? base : `${base}-${n}`;
        const where = { slug: candidate };
        if (excludeId) where.id = { [Op.ne]: excludeId };
        // eslint-disable-next-line no-await-in-loop
        if (!(await Model.findOne({ where, attributes: ['id'] }))) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
}

// ---- Settings: defaults, so the storefront always gets every key ----
const DEFAULT_SETTINGS = {
    store: {
        name: 'Stallion Eyewear', tagline: 'Frames and sunglasses, delivered', logo_url: '', support_phone: '', whatsapp: '',
        email: '', address: '', hours: 'Mon-Sat, 10am to 7pm', site_url: '', social: { instagram: '', facebook: '', youtube: '' },
    },
    banner: { headline: 'Find frames you will love', sub: 'Quality eyewear at honest prices', image: '', cta_label: 'Shop frames', cta_url: '/shop' },
    usps: [
        { title: 'Cash on delivery', text: 'Pay when your order arrives' },
        { title: 'Easy returns', text: 'Simple returns if something is wrong' },
        { title: 'Quality checked', text: 'Every frame is inspected before dispatch' },
    ],
    shipping: {
        free_over: 999, cod_enabled: true, cod_fee: 50, express_enabled: false, express_charge: 150, packing_days: 1,
        zones: [{ name: 'All India', states: [], days_min: 3, days_max: 7, charge: 60 }], blocked_pincodes: [],
    },
    tracking: { ga_id: '', meta_pixel_id: '', cookie_notice: true },
    tracking_secrets: { meta_capi_token: '', ga_api_secret: '' },
    store_enabled: true,
};
const SECRET_KEYS = ['tracking_secrets'];
const PUBLIC_KEYS = ['store', 'banner', 'usps', 'shipping', 'tracking', 'store_enabled'];

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Stored value over default; objects merge one level so a missing field falls back.
function withDefault(key, stored) {
    const def = DEFAULT_SETTINGS[key];
    if (stored === undefined || stored === null) return JSON.parse(JSON.stringify(def));
    if (isPlainObject(def)) return isPlainObject(stored) ? { ...JSON.parse(JSON.stringify(def)), ...stored } : JSON.parse(JSON.stringify(def));
    if (Array.isArray(def)) return Array.isArray(stored) ? stored : JSON.parse(JSON.stringify(def));
    return typeof def === 'boolean' ? stored === true || stored === 'true' : stored;
}

async function loadSettings(keys = Object.keys(DEFAULT_SETTINGS)) {
    const stored = await getSettings(keys);
    const out = {};
    keys.forEach((k) => { out[k] = withDefault(k, stored[k]); });
    return out;
}

// The public part of the settings (never anything from SECRET_KEYS).
async function loadPublicSettings() {
    const s = await loadSettings(PUBLIC_KEYS);
    const ship = s.shipping || {};
    const track = s.tracking || {};
    return {
        store: (() => { const { site_url: _omit, ...rest } = s.store || {}; return rest; })(),
        banner: s.banner,
        usps: s.usps,
        shipping: {
            free_over: Number(ship.free_over) || 0,
            cod_enabled: !!ship.cod_enabled,
            cod_fee: Number(ship.cod_fee) || 0,
            express_enabled: !!ship.express_enabled,
            express_charge: Number(ship.express_charge) || 0,
        },
        tracking: { ga_id: track.ga_id || '', meta_pixel_id: track.meta_pixel_id || '', cookie_notice: track.cookie_notice !== false },
        store_enabled: s.store_enabled,
    };
}

// Public address of the storefront (for absolute links in the feed / canonical). Env wins over the setting.
async function siteUrl() {
    const fromEnv = process.env.RETAIL_SITE_URL;
    let url = fromEnv;
    if (!url) {
        const s = await loadSettings(['store']);
        url = s.store && s.store.site_url;
    }
    return /^https?:\/\//i.test(url || '') ? url.replace(/\/+$/, '') : '';
}

// Where wholesale product images are served from: <API origin>/uploads/products/<filename>
// (same convention as the wholesale frontend's ProductCard).
function productImageUrl(filename) {
    const base = (process.env.RETAIL_IMAGE_BASE_URL || process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://api.stallioneyewear.in').replace(/\/+$/, '');
    return `${base}/uploads/products/${encodeURIComponent(filename)}`;
}

// ---- Content pages (about, privacy ...) ----
const CONTENT_KEYS = ['about', 'privacy', 'terms', 'returns', 'shipping'];

async function getContentPage(key) {
    if (!CONTENT_KEYS.includes(key)) return null;
    const row = await RetailContent.findOne({ where: { content_key: key } });
    if (row) return { key, title: row.title, body: sanitizeHtml(row.body), updated_at: row.updated_at };
    const { DEFAULT_CONTENT } = require('./seed'); // seed failed or not run yet: show the built-in text
    const def = DEFAULT_CONTENT[key];
    return def ? { key, title: def.title, body: sanitizeHtml(def.body), updated_at: null } : null;
}

const excerpt = (html, max = 155) => {
    const t = htmlToText(html);
    return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};

module.exports = {
    VISIBLE, LOW_STOCK_AT, CARD_ATTRS, parseJson, imageList, displayTitle, toCard, cardsByIds, slugify, uniqueSlug,
    DEFAULT_SETTINGS, SECRET_KEYS, PUBLIC_KEYS, withDefault, loadSettings, loadPublicSettings, siteUrl,
    productImageUrl, CONTENT_KEYS, getContentPage, excerpt,
};
