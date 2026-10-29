// Tiny response helpers shared by the retail routes: the { success, data } envelope from API_CONTRACT.md,
// cache headers, paging and an async wrapper that turns any error into a clean JSON reply.

class HttpError extends Error {
    constructor(status, message, extra) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

// Public cache: browsers keep it for `seconds`, shared caches/CDN for twice that and may serve stale while refreshing.
const cachePublic = (res, seconds) => res.set('Cache-Control', `public, max-age=${seconds}, s-maxage=${seconds * 2}, stale-while-revalidate=${seconds * 5}`);
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

// Wrap an async route handler: HttpError -> its status, unique clash -> 409, anything else -> 500 (logged once).
const wrap = (handler) => async (req, res, next) => {
    try {
        await handler(req, res, next);
    } catch (err) {
        if (res.headersSent) return next(err);
        if (err instanceof HttpError) return fail(res, err.status, err.message, err.extra);
        if (err && err.name === 'SequelizeUniqueConstraintError') return fail(res, 409, 'That value is already used by another record');
        console.error('[retail]', req.method, req.originalUrl, '-', err && err.message);
        return fail(res, 500, 'Something went wrong. Please try again.');
    }
};

const toInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

function paging(req, { defLimit = 24, maxLimit = 60 } = {}) {
    const page = Math.max(1, Math.min(toInt(req.query.page, 1), 100000));
    const limit = Math.max(1, Math.min(toInt(req.query.limit, defLimit), maxLimit));
    return { page, limit, offset: (page - 1) * limit };
}
const pagination = (total, page, limit) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// Query-string text: one trimmed string, capped, without LIKE wildcards.
const cleanText = (v, max = 100) => (typeof v === 'string' ? v.replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

module.exports = { HttpError, ok, fail, cachePublic, noStore, wrap, paging, pagination, toInt, isUuid, cleanText };
