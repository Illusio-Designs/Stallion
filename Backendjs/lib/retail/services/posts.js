// Blog helpers shared by the public routes (home, blog) and the sitemap.
const { Op } = require('sequelize');
const { parseJson } = require('./catalog');

// Live posts: published, and not scheduled for the future. (A null published_at counts as live.)
const publishedWhere = () => ({
    status: 'published',
    [Op.or]: [{ published_at: null }, { published_at: { [Op.lte]: new Date() } }],
});

const POST_CARD_ATTRS = ['id', 'slug', 'title', 'summary', 'cover_image', 'tags', 'published_at', 'created_at', 'read_minutes'];

const tagList = (v) => {
    const t = parseJson(v, []);
    return Array.isArray(t) ? t.filter((x) => typeof x === 'string') : [];
};

const toPostCard = (p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary || '',
    cover_image: p.cover_image || null,
    tags: tagList(p.tags),
    published_at: p.published_at || p.created_at,
    read_minutes: p.read_minutes || 1,
});

module.exports = { publishedWhere, POST_CARD_ATTRS, toPostCard, tagList };
