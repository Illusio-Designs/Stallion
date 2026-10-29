// Store analytics for the admin: funnel, traffic sources, blog landings and top frames.
// Days are India days (UTC+05:30): "30 days" = today plus the 29 India days before it.
const { Op, fn, col } = require('sequelize');
const sequelize = require('../../constants/database');
const RetailVisit = require('../models/RetailVisit');
const RetailEvent = require('../models/RetailEvent');
const RetailOrder = require('../models/RetailOrder');
const RetailOrderItem = require('../models/RetailOrderItem');
const RetailProduct = require('../models/RetailProduct');
const { istStartOfDaysAgo } = require('./istTime');

const distinct = (column) => fn('COUNT', fn('DISTINCT', col(column)));
const pct = (n, base) => (base > 0 ? Math.round((n / base) * 1000) / 10 : 0);

function slugFromLanding(path) {
    const m = /^\/blog\/([^/]+)\/?$/i.exec(path || '');
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

// Title of a blog post when the blog module is loaded; otherwise the slug is shown as is.
async function postTitles(slugs) {
    const Post = sequelize.models.RetailPost;
    if (!Post || !slugs.length) return new Map();
    try {
        const rows = await Post.findAll({ where: { slug: slugs }, attributes: ['slug', 'title'], raw: true });
        return new Map(rows.map((r) => [String(r.slug).toLowerCase(), r.title]));
    } catch (_e) {
        return new Map();
    }
}

async function summary(daysInput) {
    const days = Math.min(365, Math.max(1, parseInt(daysInput, 10) || 30));
    const since = istStartOfDaysAgo(days);
    const inRange = { created_at: { [Op.gte]: since } };
    const liveOrders = { ...inRange, status: { [Op.ne]: 'cancelled' } };

    const [visitRow, eventRows, orders, visitSources, orderSources, landings, viewRows, soldRows] = await Promise.all([
        RetailVisit.findOne({ attributes: [[distinct('session_id'), 'n']], where: inRange, raw: true }),
        RetailEvent.findAll({ attributes: ['type', [distinct('session_id'), 'sessions']], where: inRange, group: ['type'], raw: true }),
        RetailOrder.count({ where: liveOrders }),
        RetailVisit.findAll({ attributes: ['source', [distinct('session_id'), 'visits']], where: inRange, group: ['source'], raw: true }),
        RetailOrder.findAll({ attributes: ['source', [fn('COUNT', col('id')), 'orders']], where: liveOrders, group: ['source'], raw: true }),
        RetailVisit.findAll({
            attributes: ['landing_page', [fn('COUNT', col('id')), 'visits']],
            where: { ...inRange, landing_page: { [Op.like]: '/blog/%' } },
            group: ['landing_page'], raw: true,
        }),
        RetailEvent.findAll({
            attributes: ['product_id', [fn('COUNT', col('id')), 'views']],
            where: { ...inRange, type: 'view_item', product_id: { [Op.ne]: null } },
            group: ['product_id'], order: [[fn('COUNT', col('id')), 'DESC']], limit: 50, raw: true,
        }),
        RetailOrderItem.findAll({
            attributes: ['product_id', [distinct('RetailOrderItem.order_id'), 'orders']],
            include: [{ model: RetailOrder, as: 'order', attributes: [], required: true, where: liveOrders }],
            group: ['product_id'], order: [[distinct('RetailOrderItem.order_id'), 'DESC']], limit: 50, raw: true,
        }),
    ]);

    const visits = Number(visitRow.n);
    const bySession = Object.fromEntries(eventRows.map((r) => [r.type, Number(r.sessions)]));
    const viewItem = bySession.view_item || 0;
    const addToCart = bySession.add_to_cart || 0;
    const beginCheckout = bySession.begin_checkout || 0;

    const funnel = [
        { step: 'Visits', count: visits },
        { step: 'Viewed a frame', count: viewItem },
        { step: 'Added to cart', count: addToCart },
        { step: 'Started checkout', count: beginCheckout },
        { step: 'Orders', count: orders },
    ].map((s) => ({ ...s, pct: pct(s.count, visits) }));

    // sources: visits by where people came from, orders by the source stored on the order
    const sourceMap = new Map();
    const bump = (name, key, n) => {
        const k = String(name || 'direct').toLowerCase();
        const row = sourceMap.get(k) || { source: k, visits: 0, orders: 0 };
        row[key] += Number(n);
        sourceMap.set(k, row);
    };
    visitSources.forEach((r) => bump(r.source, 'visits', r.visits));
    orderSources.forEach((r) => bump(r.source, 'orders', r.orders));
    const sources = [...sourceMap.values()].sort((a, b) => b.visits - a.visits || b.orders - a.orders).slice(0, 20);

    // top posts: visits whose landing page is /blog/<slug> (trailing slash and case folded together)
    const postMap = new Map();
    landings.forEach((r) => {
        const slug = slugFromLanding(r.landing_page);
        if (slug) postMap.set(slug, (postMap.get(slug) || 0) + Number(r.visits));
    });
    const topSlugs = [...postMap].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const titles = await postTitles(topSlugs.map(([s]) => s));
    const top_posts = topSlugs.map(([slug, n]) => ({ slug, title: titles.get(slug) || slug.replace(/-/g, ' '), visits: n }));

    // top products: views and distinct orders, best sellers first
    const prodMap = new Map();
    const prod = (id) => { if (!prodMap.has(id)) prodMap.set(id, { id, views: 0, orders: 0 }); return prodMap.get(id); };
    viewRows.forEach((r) => { prod(r.product_id).views = Number(r.views); });
    soldRows.forEach((r) => { prod(r.product_id).orders = Number(r.orders); });
    const best = [...prodMap.values()].sort((a, b) => b.orders - a.orders || b.views - a.views).slice(0, 10);
    const names = best.length ? await RetailProduct.findAll({ where: { id: best.map((b) => b.id) }, attributes: ['id', 'title', 'model_no'], raw: true }) : [];
    const nameOf = new Map(names.map((p) => [p.id, p.title || p.model_no]));
    const top_products = best.map((b) => ({ id: b.id, title: nameOf.get(b.id) || 'Removed frame', views: b.views, orders: b.orders }));

    return { days, from: since.toISOString(), visits, add_to_cart: addToCart, begin_checkout: beginCheckout, orders, funnel, sources, top_posts, top_products };
}

module.exports = { summary };
