const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();

// Retail admin content routes (login required, roles checked in ../index.js or per route). See API_CONTRACT.md
// Posts, FAQs, text pages and page SEO: open to the editor role too (the whole admin router allows RETAIL_CONTENT_ROLES).
// Nothing is hard deleted: posts are archived, FAQs are switched off with is_active=false.

const RetailPost = require('../../models/RetailPost');
const RetailFaq = require('../../models/RetailFaq');
const RetailContent = require('../../models/RetailContent');
const RetailPage = require('../../models/RetailPage');
const { ok, wrap, noStore, paging, pagination, cleanText, isUuid, HttpError } = require('../../services/httpCatalog');
const { sanitizeHtml, htmlToText } = require('../../services/sanitizeHtml');
const { slugify, uniqueSlug, CONTENT_KEYS, getContentPage, parseJson } = require('../../services/catalog');
const { audit } = require('../../services/audit');
const { tagList } = require('../../services/posts');

router.use(['/posts', '/faqs', '/content', '/pages'], noStore);

const bad = (msg) => { throw new HttpError(400, msg); };

// Reads body[key] as trimmed text when present. Returns undefined if the key was not sent.
function textField(b, key, label, max, { required = false, nullable = true } = {}) {
    if (b[key] === undefined) return undefined;
    const s = b[key] === null ? '' : String(b[key]).trim();
    if (s.length > max) bad(`${label} is too long (max ${max} characters)`);
    if (required && !s) bad(`${label} is required`);
    return s || (nullable ? null : '');
}
const urlField = (b, key, label) => {
    const v = textField(b, key, label, 500);
    if (v && !/^(https?:\/\/|\/)/i.test(v)) bad(`${label} must start with http://, https:// or /`);
    return v;
};
const boolField = (b, key, label) => {
    if (b[key] === undefined) return undefined;
    if (b[key] === true || b[key] === 'true') return true;
    if (b[key] === false || b[key] === 'false') return false;
    return bad(`${label} must be true or false`);
};
const strip = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// =========================== Posts ===========================
const POST_STATUSES = ['draft', 'published', 'archived'];

const postDto = (p, { withBody = true } = {}) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    ...(withBody ? { body: p.body } : {}),
    cover_image: p.cover_image,
    tags: tagList(p.tags),
    status: p.status,
    published_at: p.published_at,
    related_product_ids: parseJson(p.related_product_ids, []),
    seo_title: p.seo_title,
    seo_description: p.seo_description,
    read_minutes: p.read_minutes,
    created_at: p.created_at,
    updated_at: p.updated_at,
});

function postFields(b) {
    const out = {
        title: textField(b, 'title', 'Title', 255, { required: true }),
        summary: textField(b, 'summary', 'Summary', 600),
        cover_image: urlField(b, 'cover_image', 'Cover image'),
        seo_title: textField(b, 'seo_title', 'SEO title', 160),
        seo_description: textField(b, 'seo_description', 'SEO description', 400),
    };
    if (b.body !== undefined) out.body = sanitizeHtml(b.body === null ? '' : String(b.body));
    if (b.tags !== undefined) {
        if (!Array.isArray(b.tags)) bad('Tags must be a list');
        const seen = new Set();
        out.tags = b.tags.map((t) => String(t).trim().slice(0, 40)).filter((t) => {
            const k = t.toLowerCase();
            if (!t || seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 10);
    }
    if (b.related_product_ids !== undefined) {
        if (!Array.isArray(b.related_product_ids)) bad('Related products must be a list');
        if (!b.related_product_ids.every(isUuid)) bad('Related products contain an invalid id');
        out.related_product_ids = [...new Set(b.related_product_ids)].slice(0, 12);
    }
    if (b.status !== undefined) {
        if (!POST_STATUSES.includes(b.status)) bad(`Status must be one of: ${POST_STATUSES.join(', ')}`);
        out.status = b.status;
    }
    if (b.published_at !== undefined) {
        if (b.published_at === null || b.published_at === '') out.published_at = null;
        else {
            const d = new Date(b.published_at);
            if (Number.isNaN(d.getTime())) bad('Publish date is not a valid date');
            out.published_at = d;
        }
    }
    return strip(out);
}

router.get('/posts', wrap(async (req, res) => {
    const { page, limit, offset } = paging(req, { defLimit: 25, maxLimit: 100 });
    const where = {};
    if (POST_STATUSES.includes(req.query.status)) where.status = req.query.status;
    const q = cleanText(req.query.search, 80);
    if (q) where[Op.or] = [{ title: { [Op.like]: `%${q}%` } }, { slug: { [Op.like]: `%${q}%` } }];
    const { rows, count } = await RetailPost.findAndCountAll({
        where, attributes: { exclude: ['body'] }, order: [['updated_at', 'DESC'], ['id', 'ASC']], limit, offset,
    });
    ok(res, rows.map((p) => postDto(p, { withBody: false })), { pagination: pagination(count, page, limit) });
}));

router.get('/posts/:id', wrap(async (req, res) => {
    const p = isUuid(req.params.id) ? await RetailPost.findByPk(req.params.id) : null;
    if (!p) throw new HttpError(404, 'Post not found');
    ok(res, postDto(p));
}));

router.post('/posts', wrap(async (req, res) => {
    const b = req.body || {};
    const f = postFields({ ...b, title: b.title });
    if (!f.title) bad('Title is required');
    // explicit slug that is taken -> 409; no slug (or generated from title) -> next free one
    let slug;
    if (b.slug) {
        slug = slugify(b.slug, 200);
        if (await RetailPost.findOne({ where: { slug }, attributes: ['id'] })) throw new HttpError(409, 'That link name is already used by another post');
    } else {
        slug = await uniqueSlug(RetailPost, slugify(f.title, 120));
    }
    if (!f.summary && f.body) f.summary = htmlToText(f.body).slice(0, 200) || null;
    if ((f.status || 'draft') === 'published' && !f.published_at) f.published_at = new Date();
    const post = await RetailPost.create({ ...f, slug, status: f.status || 'draft', tags: f.tags || [], related_product_ids: f.related_product_ids || [] });
    await audit(req, 'create', 'retail_posts', post.id, `Retail: created post "${post.title}"`);
    res.status(201);
    ok(res, postDto(post));
}));

// Any field, including status (draft | published | archived). Archive instead of deleting.
router.put('/posts/:id', wrap(async (req, res) => {
    const post = isUuid(req.params.id) ? await RetailPost.findByPk(req.params.id) : null;
    if (!post) throw new HttpError(404, 'Post not found');
    const b = req.body || {};
    const f = postFields(b);
    if (b.slug !== undefined) {
        const slug = slugify(b.slug, 200);
        if (slug !== post.slug) {
            if (await RetailPost.findOne({ where: { slug, id: { [Op.ne]: post.id } }, attributes: ['id'] })) throw new HttpError(409, 'That link name is already used by another post');
            f.slug = slug;
        }
    }
    // First time it goes live: stamp the date unless the editor chose one (a future date schedules it).
    if (f.status === 'published' && f.published_at === undefined && !post.published_at) f.published_at = new Date();
    const prevStatus = post.status;
    await post.update(f);
    await audit(req, 'update', 'retail_posts', post.id, `Retail: edited post "${post.title}"`, { status: prevStatus }, { fields: Object.keys(f), status: post.status });
    ok(res, postDto(post));
}));

// =========================== FAQs ===========================
const faqDto = (f) => ({ id: f.id, category: f.category, question: f.question, answer: f.answer, sort_order: f.sort_order, is_active: f.is_active, updated_at: f.updated_at });

function faqFields(b, { creating }) {
    const out = {
        category: textField(b, 'category', 'Category', 80, { nullable: false }),
        question: textField(b, 'question', 'Question', 400, { required: true }),
        sort_order: undefined,
        is_active: boolField(b, 'is_active', 'is_active'),
    };
    if (b.answer !== undefined) {
        out.answer = sanitizeHtml(b.answer === null ? '' : String(b.answer));
        if (!htmlToText(out.answer)) bad('Answer is required');
    }
    if (b.sort_order !== undefined) {
        const n = Number(b.sort_order);
        if (!Number.isInteger(n) || n < -100000 || n > 100000) bad('Order must be a whole number');
        out.sort_order = n;
    }
    if (creating) {
        if (!out.question) bad('Question is required');
        if (out.answer === undefined) bad('Answer is required');
    }
    if (out.category === '') out.category = 'General';
    return strip(out);
}

router.get('/faqs', wrap(async (_req, res) => {
    const rows = await RetailFaq.findAll({ order: [['category', 'ASC'], ['sort_order', 'ASC'], ['created_at', 'ASC']], limit: 1000 });
    ok(res, rows.map(faqDto));
}));

router.post('/faqs', wrap(async (req, res) => {
    const f = faqFields(req.body || {}, { creating: true });
    if (f.sort_order === undefined) f.sort_order = ((await RetailFaq.max('sort_order')) ?? -1) + 1; // goes to the end
    const faq = await RetailFaq.create(f);
    await audit(req, 'create', 'retail_faqs', faq.id, 'Retail: added a FAQ');
    res.status(201);
    ok(res, faqDto(faq));
}));

router.put('/faqs/:id', wrap(async (req, res) => {
    const faq = isUuid(req.params.id) ? await RetailFaq.findByPk(req.params.id) : null;
    if (!faq) throw new HttpError(404, 'FAQ not found');
    const changes = faqFields(req.body || {}, { creating: false });
    await faq.update(changes);
    await audit(req, 'update', 'retail_faqs', faq.id, 'Retail: edited a FAQ', null, { fields: Object.keys(changes) });
    ok(res, faqDto(faq));
}));

// =========================== Text pages (about, privacy ...) ===========================
router.get('/content', wrap(async (_req, res) => {
    const out = [];
    for (const key of CONTENT_KEYS) {
        // eslint-disable-next-line no-await-in-loop
        const page = await getContentPage(key);
        out.push({ key, title: page.title, updated_at: page.updated_at });
    }
    ok(res, out);
}));

router.get('/content/:key', wrap(async (req, res) => {
    const key = String(req.params.key).toLowerCase();
    if (!CONTENT_KEYS.includes(key)) throw new HttpError(404, 'Page not found');
    const row = await RetailContent.findOne({ where: { content_key: key } });
    if (row) return ok(res, { key, title: row.title, body: row.body || '', updated_at: row.updated_at });
    const def = await getContentPage(key); // not saved yet: show the built-in starting text
    ok(res, { key, title: def.title, body: def.body, updated_at: null });
}));

router.put('/content/:key', wrap(async (req, res) => {
    const key = String(req.params.key).toLowerCase();
    if (!CONTENT_KEYS.includes(key)) throw new HttpError(404, 'Page not found');
    const b = req.body || {};
    const title = textField(b, 'title', 'Title', 200, { nullable: false });
    if (title === '') bad('Title cannot be empty');
    const body = b.body === undefined ? undefined : sanitizeHtml(b.body === null ? '' : String(b.body));

    let row = await RetailContent.findOne({ where: { content_key: key } });
    if (!row) {
        const def = await getContentPage(key);
        row = await RetailContent.create({ content_key: key, title: title || def.title, body: body !== undefined ? body : def.body });
    } else {
        await row.update(strip({ title, body }));
    }
    await audit(req, 'update', 'retail_content', row.id, `Retail: edited the ${key} page`);
    ok(res, { key, title: row.title, body: row.body || '', updated_at: row.updated_at });
}));

// =========================== Page SEO ===========================
const pageDto = (p) => ({ id: p.id, path: p.path, title: p.title, description: p.description, og_image: p.og_image, canonical: p.canonical, noindex: p.noindex, updated_at: p.updated_at });

function normalisePath(raw) {
    let p = String(raw || '').split('#')[0].split('?')[0].trim();
    if (!p) bad('Path is required, for example /shop');
    if (!p.startsWith('/')) p = `/${p}`;
    p = p.replace(/\/{2,}/g, '/');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    if (p.length > 200) bad('Path is too long');
    return p;
}

router.get('/pages', wrap(async (_req, res) => {
    const rows = await RetailPage.findAll({ order: [['path', 'ASC']], limit: 1000 });
    ok(res, rows.map(pageDto));
}));

// Upsert by path: { path, title, description, og_image, canonical, noindex }. Fields that are not sent keep their value.
router.put('/pages', wrap(async (req, res) => {
    const b = req.body || {};
    const path = normalisePath(b.path);
    const f = strip({
        title: textField(b, 'title', 'Title', 160),
        description: textField(b, 'description', 'Description', 400),
        og_image: urlField(b, 'og_image', 'Share image'),
        canonical: urlField(b, 'canonical', 'Canonical link'),
        noindex: boolField(b, 'noindex', 'noindex'),
    });
    let row = await RetailPage.findOne({ where: { path } });
    if (row) await row.update(f);
    else row = await RetailPage.create({ path, ...f });
    await audit(req, 'update', 'retail_pages', row.id, `Retail: edited SEO for ${path}`, null, f);
    ok(res, pageDto(row));
}));

module.exports = router;
