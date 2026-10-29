const express = require('express');
const router = express.Router();

// Public (no login) content routes: blog, text pages, FAQs, SEO, sitemap and the product feed.
// See Backendjs/lib/retail/API_CONTRACT.md

const RetailProduct = require('../../models/RetailProduct');
const RetailPost = require('../../models/RetailPost');
const RetailFaq = require('../../models/RetailFaq');
const RetailPage = require('../../models/RetailPage');
const State = require('../../../models/State');
const { ok, wrap, cachePublic, paging, pagination, cleanText, HttpError } = require('../../services/httpCatalog');
const { sanitizeHtml, htmlToText } = require('../../services/sanitizeHtml');
const {
    VISIBLE, CARD_ATTRS, cardsByIds, imageList, displayTitle, loadSettings, siteUrl, getContentPage, CONTENT_KEYS, excerpt, parseJson,
} = require('../../services/catalog');
const { publishedWhere, toPostCard, POST_CARD_ATTRS, tagList } = require('../../services/posts');

const POST_ORDER = [['published_at', 'DESC'], ['created_at', 'DESC'], ['id', 'ASC']];

// ---- Blog list ----
router.get('/blog', wrap(async (req, res) => {
    const { page, limit, offset } = paging(req, { defLimit: 12, maxLimit: 50 });
    const tag = cleanText(req.query.tag, 40).toLowerCase();
    cachePublic(res, 60);

    if (!tag) {
        const { rows, count } = await RetailPost.findAndCountAll({ where: publishedWhere(), attributes: POST_CARD_ATTRS, order: POST_ORDER, limit, offset });
        return ok(res, rows.map(toPostCard), { pagination: pagination(count, page, limit) });
    }
    // Tags live in a JSON column; filter in memory (a shop blog has tens of posts, capped at 1000) to stay database independent.
    const all = await RetailPost.findAll({ where: publishedWhere(), attributes: POST_CARD_ATTRS, order: POST_ORDER, limit: 1000 });
    const matched = all.filter((p) => tagList(p.tags).some((t) => t.toLowerCase() === tag));
    ok(res, matched.slice(offset, offset + limit).map(toPostCard), { pagination: pagination(matched.length, page, limit) });
}));

// ---- Blog post ----
router.get('/blog/:slug', wrap(async (req, res) => {
    const slug = cleanText(req.params.slug, 200);
    const post = slug ? await RetailPost.findOne({ where: { slug, ...publishedWhere() } }) : null;
    if (!post) throw new HttpError(404, 'This article was not found');
    const store = (await loadSettings(['store'])).store;
    const body = sanitizeHtml(post.body);
    cachePublic(res, 60);
    ok(res, {
        ...toPostCard(post),
        id: post.id,
        body,
        updated_at: post.updated_at,
        related_products: await cardsByIds(parseJson(post.related_product_ids, [])),
        seo: {
            title: post.seo_title || `${post.title} | ${store.name}`,
            description: post.seo_description || post.summary || excerpt(body),
            og_image: post.cover_image || null,
        },
    });
}));

// ---- Text pages ----
router.get('/pages/:key', wrap(async (req, res) => {
    const page = await getContentPage(String(req.params.key || '').toLowerCase());
    if (!page) throw new HttpError(404, 'Page not found');
    cachePublic(res, 300);
    ok(res, page);
}));

// ---- FAQs: grouped by category, in the admin's order ----
router.get('/faqs', wrap(async (_req, res) => {
    const rows = await RetailFaq.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['created_at', 'ASC'], ['id', 'ASC']] });
    const groups = new Map(); // Map keeps insertion order => categories appear in the order of their first (lowest sort_order) question
    rows.forEach((f) => {
        if (!groups.has(f.category)) groups.set(f.category, []);
        groups.get(f.category).push({ id: f.id, question: f.question, answer: sanitizeHtml(f.answer) });
    });
    cachePublic(res, 300);
    ok(res, [...groups.entries()].map(([category, items]) => ({ category, items })));
}));

// ---- States for the address form: Stallion's own `states` table, so names match the shipping zones and checkout ----
router.get('/states', wrap(async (_req, res) => {
    const rows = await State.findAll({ where: { is_active: true }, attributes: ['name', 'code'], order: [['name', 'ASC']], raw: true });
    cachePublic(res, 600);
    ok(res, rows);
}));

// ---- SEO for a storefront path ----
function normalisePath(raw) {
    let p = String(raw || '/').split('#')[0].split('?')[0].trim();
    if (!p.startsWith('/')) p = `/${p}`;
    p = p.replace(/\/{2,}/g, '/');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p.slice(0, 200);
}

router.get('/seo', wrap(async (req, res) => {
    const path = normalisePath(req.query.path);
    const [settings, base] = await Promise.all([loadSettings(['store', 'banner']), siteUrl()]);
    const { store, banner } = settings;
    const defaults = {
        title: store.tagline ? `${store.name} | ${store.tagline}` : store.name,
        description: banner.sub || store.tagline || '',
        og_image: banner.image || store.logo_url || null,
        canonical: base ? `${base}${path === '/' ? '' : path}` : null,
        noindex: false,
    };

    // 1) a row the admin wrote for this exact path
    const row = await RetailPage.findOne({ where: { path } });
    let derived = null;
    // 2) otherwise, product and article pages use their own SEO fields
    if (!row) {
        const m = /^\/(shop|blog)\/([^/]+)$/.exec(path);
        if (m && m[1] === 'shop') {
            const p = await RetailProduct.findOne({ where: { slug: m[2], show_on_store: true, is_active: true } });
            if (p) derived = { title: p.seo_title || `${displayTitle(p)} | ${store.name}`, description: p.seo_description || excerpt(sanitizeHtml(p.description)) || `Buy ${displayTitle(p)} online from ${store.name}.`, og_image: imageList(p.images)[0] || null };
        } else if (m) {
            const post = await RetailPost.findOne({ where: { slug: m[2], ...publishedWhere() } });
            if (post) derived = { title: post.seo_title || `${post.title} | ${store.name}`, description: post.seo_description || post.summary || '', og_image: post.cover_image || null };
        }
    }
    const src = row || derived || {};
    cachePublic(res, 300);
    ok(res, {
        title: src.title || defaults.title,
        description: src.description || defaults.description,
        og_image: src.og_image || defaults.og_image,
        canonical: src.canonical || defaults.canonical,
        noindex: !!src.noindex,
    });
}));

// ---- Sitemap ----
const STATIC_PAGES = [
    { path: '/', changefreq: 'daily', priority: 1.0 },
    { path: '/shop', changefreq: 'daily', priority: 0.9 },
    { path: '/blog', changefreq: 'weekly', priority: 0.7 },
    { path: '/help', changefreq: 'monthly', priority: 0.5 },
    { path: '/contact', changefreq: 'yearly', priority: 0.4 },
];
const iso = (d) => (d ? new Date(d).toISOString() : null);

router.get('/sitemap', wrap(async (_req, res) => {
    const [products, posts, contents, noindexRows] = await Promise.all([
        RetailProduct.findAll({ where: { show_on_store: true, is_active: true }, attributes: ['slug', 'updated_at'], order: [['updated_at', 'DESC']], limit: 5000 }),
        RetailPost.findAll({ where: publishedWhere(), attributes: ['slug', 'updated_at', 'published_at'], order: POST_ORDER, limit: 5000 }),
        require('../../models/RetailContent').findAll({ attributes: ['content_key', 'updated_at'] }),
        RetailPage.findAll({ where: { noindex: true }, attributes: ['path'] }),
    ]);
    const hidden = new Set(noindexRows.map((r) => r.path));
    const contentDates = new Map(contents.map((c) => [c.content_key, c.updated_at]));
    const items = [
        ...STATIC_PAGES.map((p) => ({ ...p, lastmod: null })),
        // storefront routes: /about, and the four policies under /policies/<key>
        ...CONTENT_KEYS.map((k) => ({ path: k === 'about' ? '/about' : `/policies/${k}`, lastmod: iso(contentDates.get(k)), changefreq: 'yearly', priority: 0.3 })),
        ...products.map((p) => ({ path: `/shop/${p.slug}`, lastmod: iso(p.updated_at), changefreq: 'weekly', priority: 0.8 })),
        ...posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: iso(p.updated_at), changefreq: 'monthly', priority: 0.6 })),
    ].filter((i) => !hidden.has(i.path));
    cachePublic(res, 1800);
    ok(res, items);
}));

// ---- Product feed (Google Merchant style) ----
router.get('/feed/products', wrap(async (_req, res) => {
    const [rows, base, settings] = await Promise.all([
        RetailProduct.findAll({ where: VISIBLE(), attributes: [...CARD_ATTRS, 'description', 'frame_type', 'gender'], order: [['created_at', 'DESC'], ['id', 'ASC']], limit: 5000 }),
        siteUrl(),
        loadSettings(['store']),
    ]);
    const brandName = settings.store.name;
    const items = rows.map((p) => {
        const title = displayTitle(p);
        const images = imageList(p.images);
        return {
            id: p.id,
            title,
            description: htmlToText(sanitizeHtml(p.description)).slice(0, 4900) || title,
            link: `${base}/shop/${p.slug}`,
            image_link: images[0] || null,
            additional_image_link: images.slice(1, 10),
            price: `${(Number(p.mrp) || 0).toFixed(2)} INR`,
            availability: 'in stock',
            condition: 'new',
            brand: p.brand_name || brandName,
            mpn: p.model_no,
        };
    });
    cachePublic(res, 1800);
    ok(res, items);
}));

module.exports = router;
