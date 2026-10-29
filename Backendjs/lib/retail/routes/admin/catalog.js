const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

// Retail admin catalog routes (login required, roles checked in ../index.js or per route). See API_CONTRACT.md
// Sync and product management are for managers only (RETAIL_ADMIN_ROLES).

const RetailProduct = require('../../models/RetailProduct');
const { checkRole } = require('../../../middleware/roleAuth');
const { RETAIL_ADMIN_ROLES } = require('../roles');
const { ok, wrap, noStore, paging, pagination, cleanText, isUuid, HttpError } = require('../../services/http');
const { sanitizeHtml } = require('../../services/sanitizeHtml');
const { slugify, imageList } = require('../../services/catalog');
const { audit } = require('../../services/audit');
const { syncFromStallion } = require('../../services/sync');

router.use(['/products', '/sync'], noStore, checkRole(RETAIL_ADMIN_ROLES));

const serialize = (p) => ({
    id: p.id,
    source_product_id: p.source_product_id,
    model_no: p.model_no,
    slug: p.slug,
    title: p.title,
    description: p.description,
    brand_name: p.brand_name,
    shape: p.shape,
    frame_type: p.frame_type,
    frame_material: p.frame_material,
    lens_color: p.lens_color,
    lens_material: p.lens_material,
    gender: p.gender,
    color: p.color,
    size_mm: p.size_mm,
    mrp: Number(p.mrp) || 0,
    stock: p.stock,
    images: imageList(p.images),
    show_on_store: p.show_on_store,
    is_active: p.is_active,
    total_sold: p.total_sold,
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    synced_at: p.synced_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
});

const asBool = (v, label) => {
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    throw new HttpError(400, `${label} must be true or false`);
};

// ---- Sync from the Stallion products table ----
router.post('/sync', wrap(async (req, res) => {
    const refreshMrp = req.body && (req.body.refresh_mrp === true || req.body.refresh_mrp === 'true');
    const result = await syncFromStallion({ refreshMrp });
    await audit(req, 'update', 'retail_products', null, 'Retail: synced frames from the Stallion catalogue', null, result);
    ok(res, result);
}));

// ---- Product list ----
router.get('/products', wrap(async (req, res) => {
    const { page, limit, offset } = paging(req, { defLimit: 25, maxLimit: 100 });
    const where = {};
    if (req.query.shown === 'true' || req.query.shown === 'false') where.show_on_store = req.query.shown === 'true';
    if (req.query.active === 'true' || req.query.active === 'false') where.is_active = req.query.active === 'true';
    if (req.query.stock === 'out') where.stock = 0;
    if (req.query.stock === 'low') where.stock = { [Op.between]: [1, 5] };
    const words = cleanText(req.query.search, 80).split(' ').filter(Boolean).slice(0, 5);
    if (words.length) {
        where[Op.and] = words.map((w) => ({
            [Op.or]: ['model_no', 'title', 'slug', 'brand_name', 'shape', 'color'].map((c) => ({ [c]: { [Op.like]: `%${w}%` } })),
        }));
    }
    const { rows, count } = await RetailProduct.findAndCountAll({ where, order: [['updated_at', 'DESC'], ['id', 'ASC']], limit, offset });
    ok(res, rows.map(serialize), { pagination: pagination(count, page, limit) });
}));

// ---- Bulk show / hide (declared before /products/:id) ----
router.post('/products/bulk', wrap(async (req, res) => {
    const { ids, show_on_store } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Choose at least one frame');
    if (ids.length > 500) throw new HttpError(400, 'Choose at most 500 frames at a time');
    if (!ids.every(isUuid)) throw new HttpError(400, 'One or more ids are not valid');
    const show = asBool(show_on_store, 'show_on_store');

    const where = { id: { [Op.in]: ids } };
    let blocked = 0;
    if (show) {
        // a frame without a price cannot go on sale
        blocked = await RetailProduct.count({ where: { ...where, mrp: { [Op.lte]: 0 } } });
        where.mrp = { [Op.gt]: 0 };
    }
    const [updated] = await RetailProduct.update({ show_on_store: show }, { where });
    await audit(req, 'update', 'retail_products', null, `Retail: ${show ? 'showed' : 'hid'} ${updated} frame(s) on the store`, null, { ids, show_on_store: show });
    ok(res, { updated, skipped_without_price: blocked });
}));

router.get('/products/:id', wrap(async (req, res) => {
    const p = isUuid(req.params.id) ? await RetailProduct.findByPk(req.params.id) : null;
    if (!p) throw new HttpError(404, 'Frame not found');
    ok(res, serialize(p));
}));

// ---- Edit one frame (only the store-owned fields below can be changed) ----
router.put('/products/:id', wrap(async (req, res) => {
    const p = isUuid(req.params.id) ? await RetailProduct.findByPk(req.params.id) : null;
    if (!p) throw new HttpError(404, 'Frame not found');
    const b = req.body || {};
    const patch = {};
    const str = (key, label, max, { required = false } = {}) => {
        if (b[key] === undefined) return;
        const s = b[key] === null ? '' : String(b[key]).trim();
        if (s.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters)`);
        if (required && !s) throw new HttpError(400, `${label} cannot be empty`);
        patch[key] = s || null;
    };

    if (b.show_on_store !== undefined) patch.show_on_store = asBool(b.show_on_store, 'show_on_store');
    if (b.is_active !== undefined) patch.is_active = asBool(b.is_active, 'is_active');
    if (b.stock !== undefined) {
        const n = Number(b.stock);
        if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new HttpError(400, 'Stock must be a whole number, 0 or more');
        patch.stock = n;
    }
    if (b.mrp !== undefined) {
        const n = Number(b.mrp);
        if (!Number.isFinite(n) || n < 0 || n > 10000000) throw new HttpError(400, 'MRP must be an amount in rupees, 0 or more');
        patch.mrp = Math.round(n * 100) / 100;
    }
    str('title', 'Title', 255);
    str('seo_title', 'SEO title', 160);
    str('seo_description', 'SEO description', 400);
    if (b.description !== undefined) {
        const html = sanitizeHtml(b.description === null ? '' : String(b.description));
        patch.description = html || null;
    }
    if (b.slug !== undefined) {
        const slug = slugify(b.slug, 200);
        if (slug !== p.slug) {
            if (await RetailProduct.findOne({ where: { slug, id: { [Op.ne]: p.id } }, attributes: ['id'] })) throw new HttpError(409, 'That link name is already used by another frame');
            patch.slug = slug;
        }
    }
    // a frame on sale must have a price
    const finalShow = patch.show_on_store !== undefined ? patch.show_on_store : p.show_on_store;
    const finalMrp = patch.mrp !== undefined ? patch.mrp : Number(p.mrp);
    if (finalShow && finalMrp <= 0 && (patch.show_on_store !== undefined || patch.mrp !== undefined)) {
        throw new HttpError(400, 'Set a price (MRP) before showing this frame on the store');
    }

    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, p[k]]));
    await p.update(patch);
    await audit(req, 'update', 'retail_products', p.id, `Retail: edited frame ${p.model_no}`, before, patch);
    ok(res, serialize(p));
}));

module.exports = router;
