const express = require('express');
const { Op, fn, col } = require('sequelize');
const router = express.Router();

// Public (no login) catalog routes. See Backendjs/lib/retail/API_CONTRACT.md
// Only frames with show_on_store && is_active && stock > 0 are listed. Nothing wholesale is ever read or returned.

const RetailProduct = require('../../models/RetailProduct');
const RetailPost = require('../../models/RetailPost');
const { ok, wrap, cachePublic, paging, pagination, cleanText, HttpError } = require('../../services/httpCatalog');
const { sanitizeHtml } = require('../../services/sanitizeHtml');
const {
    VISIBLE, CARD_ATTRS, LOW_STOCK_AT, toCard, imageList, displayTitle, loadSettings, loadPublicSettings, excerpt,
} = require('../../services/catalog');
const { publishedWhere, toPostCard, POST_CARD_ATTRS } = require('../../services/posts');

// "a,b" or ["a","b"] -> ["a","b"] (trimmed, max 20)
const listParam = (v) => {
    const raw = Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : '';
    return raw.split(',').map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 20);
};
const numParam = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

const SORTS = {
    popular: [['total_sold', 'DESC'], ['created_at', 'DESC'], ['id', 'ASC']],
    new: [['created_at', 'DESC'], ['id', 'ASC']],
    price_asc: [['mrp', 'ASC'], ['id', 'ASC']],
    price_desc: [['mrp', 'DESC'], ['id', 'ASC']],
};
const SEARCH_COLUMNS = ['title', 'model_no', 'brand_name', 'shape', 'frame_type', 'frame_material', 'color', 'gender'];

// Free text: every word must match at least one searchable column.
function searchClauses(text) {
    const words = cleanText(text, 80).split(' ').filter(Boolean).slice(0, 5);
    return words.map((w) => ({ [Op.or]: SEARCH_COLUMNS.map((c) => ({ [c]: { [Op.like]: `%${w}%` } })) }));
}

// ---- Settings ----
router.get('/settings', wrap(async (_req, res) => {
    cachePublic(res, 60);
    ok(res, await loadPublicSettings());
}));

// ---- Home ----
router.get('/home', wrap(async (_req, res) => {
    const [settings, featured, shapeRows, posts] = await Promise.all([
        loadSettings(['banner']),
        RetailProduct.findAll({ where: VISIBLE(), attributes: CARD_ATTRS, order: SORTS.popular, limit: 8 }),
        RetailProduct.findAll({ where: { ...VISIBLE(), shape: { [Op.ne]: null } }, attributes: ['shape', 'images'], order: SORTS.popular, limit: 400 }),
        RetailPost.findAll({ where: publishedWhere(), attributes: POST_CARD_ATTRS, order: [['published_at', 'DESC'], ['created_at', 'DESC']], limit: 3 }),
    ]);
    // Count per shape + the image of its best-selling visible frame.
    const shapes = new Map();
    shapeRows.forEach((r) => {
        const name = (r.shape || '').trim();
        if (!name) return;
        const cur = shapes.get(name) || { name, count: 0, image: null };
        cur.count += 1;
        if (!cur.image) cur.image = imageList(r.images)[0] || null;
        shapes.set(name, cur);
    });
    cachePublic(res, 60);
    ok(res, {
        banner: settings.banner,
        featured: featured.map(toCard),
        shapes: [...shapes.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        posts: posts.map(toPostCard),
    });
}));

// ---- Product list ----
router.get('/products', wrap(async (req, res) => {
    const { page, limit, offset } = paging(req, { defLimit: 24, maxLimit: 60 });
    const where = { ...VISIBLE() };
    const and = searchClauses(req.query.search);

    for (const field of ['shape', 'frame_type', 'frame_material', 'gender']) {
        const values = listParam(req.query[field]);
        if (values.length) where[field] = values.length === 1 ? values[0] : { [Op.in]: values };
    }
    const colors = listParam(req.query.color);
    if (colors.length) where.color = colors.length === 1 ? colors[0] : { [Op.in]: colors };

    const min = numParam(req.query.min_price);
    const max = numParam(req.query.max_price);
    if (min !== null || max !== null) {
        where.mrp = {};
        if (min !== null) where.mrp[Op.gte] = min;
        if (max !== null) where.mrp[Op.lte] = max;
    }
    if (and.length) where[Op.and] = and;

    const order = SORTS[req.query.sort] || SORTS.popular;
    const { rows, count } = await RetailProduct.findAndCountAll({ where, attributes: CARD_ATTRS, order, limit, offset });
    cachePublic(res, 30);
    ok(res, rows.map(toCard), { pagination: pagination(count, page, limit) });
}));

// ---- Filter facets (must be declared before /products/:slug) ----
router.get('/products/filters', wrap(async (_req, res) => {
    const facet = async (field) => {
        const rows = await RetailProduct.findAll({
            where: { ...VISIBLE(), [field]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
            attributes: [field, [fn('COUNT', col('id')), 'n']],
            group: [field],
            raw: true,
        });
        return rows.map((r) => ({ name: r[field], count: Number(r.n) })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };
    const [shapes, frame_types, frame_materials, genders, colors, price] = await Promise.all([
        facet('shape'), facet('frame_type'), facet('frame_material'), facet('gender'), facet('color'),
        RetailProduct.findOne({ where: VISIBLE(), attributes: [[fn('MIN', col('mrp')), 'min'], [fn('MAX', col('mrp')), 'max']], raw: true }),
    ]);
    cachePublic(res, 60);
    ok(res, {
        shapes, frame_types, frame_materials, genders, colors,
        price: { min: Number(price && price.min) || 0, max: Number(price && price.max) || 0 },
    });
}));

// ---- Search suggestions ----
router.get('/search/suggest', wrap(async (req, res) => {
    const q = cleanText(req.query.q, 60);
    cachePublic(res, 30);
    if (q.length < 2) return ok(res, []);
    const rows = await RetailProduct.findAll({
        where: { ...VISIBLE(), [Op.and]: searchClauses(q) },
        attributes: CARD_ATTRS,
        order: SORTS.popular,
        limit: 6,
    });
    ok(res, rows.map((p) => ({ title: displayTitle(p), slug: p.slug, image: imageList(p.images)[0] || null, mrp: Number(p.mrp) || 0 })));
}));

// ---- Product detail ----
router.get('/products/:slug', wrap(async (req, res) => {
    const slug = cleanText(req.params.slug, 280);
    const p = slug ? await RetailProduct.findOne({ where: { slug, show_on_store: true, is_active: true } }) : null;
    if (!p) throw new HttpError(404, 'This frame is not available');

    // Same model in other colours (only those on sale, plus this one).
    const siblings = await RetailProduct.findAll({
        where: { model_no: p.model_no, show_on_store: true, is_active: true, [Op.or]: [{ stock: { [Op.gt]: 0 } }, { id: p.id }] },
        attributes: ['id', 'slug', 'color', 'stock'],
        order: [['color', 'ASC'], ['id', 'ASC']],
    });

    // Related: same shape / material / gender first, then top sellers to fill four.
    const relatedBase = { ...VISIBLE(), id: { [Op.ne]: p.id }, model_no: { [Op.ne]: p.model_no } };
    const likeness = [p.shape && { shape: p.shape }, p.frame_material && { frame_material: p.frame_material }, p.gender && { gender: p.gender }].filter(Boolean);
    let related = likeness.length
        ? await RetailProduct.findAll({ where: { ...relatedBase, [Op.or]: likeness }, attributes: CARD_ATTRS, order: SORTS.popular, limit: 4 })
        : [];
    if (related.length < 4) {
        const have = [p.id, ...related.map((r) => r.id)];
        const more = await RetailProduct.findAll({
            where: { ...relatedBase, id: { [Op.notIn]: have } }, attributes: CARD_ATTRS, order: SORTS.popular, limit: 4 - related.length,
        });
        related = related.concat(more);
    }

    const store = (await loadSettings(['store'])).store;
    const card = toCard(p);
    const description = sanitizeHtml(p.description);
    const stock = Number(p.stock) || 0;
    const lens = [p.lens_color, p.lens_material].filter(Boolean).join(' · ');
    const images = imageList(p.images);
    cachePublic(res, 30);
    ok(res, {
        ...card,
        description,
        images,
        specs: {
            shape: p.shape || null,
            frame_type: p.frame_type || null,
            frame_material: p.frame_material || null,
            lens: lens || null,
            lens_color: p.lens_color || null,
            lens_material: p.lens_material || null,
            size_mm: p.size_mm || null,
            gender: p.gender || null,
            brand: p.brand_name || null,
        },
        colors: siblings.map((s) => ({ name: s.color || 'Standard', slug: s.slug, stock: Number(s.stock) || 0 })),
        related: related.map(toCard),
        seo: {
            title: p.seo_title || `${card.title} | ${store.name}`,
            description: p.seo_description || excerpt(description) || `Buy ${card.title} online from ${store.name}.`,
            og_image: images[0] || null,
        },
        stock,
        low_stock: stock <= LOW_STOCK_AT,
    });
}));

module.exports = router;
