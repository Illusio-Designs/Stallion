const { Op, fn, col, where: sqlWhere } = require('sequelize');

/** Optional `name`, `search` (alias for name), and `phone` from query string. */
function getListSearchParams(req) {
    const name = String(req.query.name ?? req.query.search ?? '').trim();
    const phone = String(req.query.phone ?? '').trim();
    return {
        name: name || null,
        phone: phone || null,
    };
}

/**
 * Build a Sequelize where fragment for partial name / phone matches.
 * `name` matches any of `nameFields`; `phone` matches any of `phoneFields`.
 */
function buildNamePhoneFilter({ name, phone, nameFields = [], phoneFields = [], ignoreSpaces = false }) {
    const conditions = [];

    if (name && nameFields.length > 0) {
        const term = likeContains(name);
        const ors = nameFields.map((field) => ({ [field]: { [Op.like]: term } }));
        // "rajopti" should find "Raj Optical": compare again with the spaces left out of both sides.
        const tight = name.replace(/\s+/g, '');
        if (ignoreSpaces && tight) {
            ors.push(...nameFields.map((field) => sqlWhere(fn('REPLACE', col(field), ' ', ''), { [Op.like]: likeContains(tight) })));
        }
        conditions.push({ [Op.or]: ors });
    }

    if (phone && phoneFields.length > 0) {
        const term = likeContains(phone);
        conditions.push({
            [Op.or]: phoneFields.map((field) => ({ [field]: { [Op.like]: term } })),
        });
    }

    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];
    return { [Op.and]: conditions };
}

// Sequelize operators (Op.or, Op.and, ...) are Symbol keys, which Object.keys() does not list.
// Counting only string keys made every search filter look empty, so searches were silently dropped.
const hasWhereKeys = (obj) => !!obj && Reflect.ownKeys(obj).length > 0;

function mergeWhere(baseWhere, searchFilter) {
    const hasBase = hasWhereKeys(baseWhere);
    const hasSearch = hasWhereKeys(searchFilter);
    if (!hasBase && !hasSearch) return {};
    if (!hasSearch) return baseWhere;
    if (!hasBase) return searchFilter;
    return { [Op.and]: [baseWhere, searchFilter] };
}

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;
/** Hard cap for list endpoints called without page/limit (legacy array responses). */
const UNPAGINATED_CAP = 500;

/** Escape LIKE wildcards (% _) and the escape char (\\) so user input matches literally. */
function escapeLike(value) {
    return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}

/** `%term%` pattern with the term's wildcards escaped. */
function likeContains(value) {
    return `%${escapeLike(value)}%`;
}

function toInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

function clampPagination(rawPage, rawLimit) {
    const page = Math.max(1, toInt(rawPage, 1));
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, toInt(rawLimit, DEFAULT_PAGE_LIMIT)));
    return { page, limit, offset: (page - 1) * limit };
}

/** `page` and `limit` from query string, always safe: page >= 1, limit 1..100. */
function parsePaginationParams(req) {
    const { page, limit } = req.query || {};
    return clampPagination(page, limit);
}

/** True when the request asked for pagination (has `page` or `limit`). */
function hasPaginationParams(req) {
    const q = req.query || {};
    return (q.page !== undefined && q.page !== '') || (q.limit !== undefined && q.limit !== '');
}

/**
 * Optional pagination: returns the pagination object when `page`/`limit` are present,
 * otherwise null (caller returns the legacy array, capped at UNPAGINATED_CAP rows).
 */
function parseOptionalPagination(req) {
    return hasPaginationParams(req) ? parsePaginationParams(req) : null;
}

function buildPaginatedResponse(data, { page, limit }, count) {
    const total = Number.isFinite(Number(count)) ? Number(count) : 0;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_PAGE_LIMIT;
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 0,
        },
    };
}

/**
 * Run a list query with OPTIONAL pagination (backward compatible):
 *  - request has `page`/`limit` -> findAndCountAll, respond with buildPaginatedResponse shape
 *  - neither -> findAll capped at UNPAGINATED_CAP, respond with a plain array (legacy shape)
 * `options` must include a deterministic `order`. `mapRows(rows)` may be async.
 * Returns the body to send with res.json().
 */
async function listWithOptionalPagination(Model, req, options = {}, mapRows = (rows) => rows) {
    const pagination = parseOptionalPagination(req);
    if (pagination) {
        const { count, rows } = await Model.findAndCountAll({
            ...options,
            limit: pagination.limit,
            offset: pagination.offset,
        });
        return buildPaginatedResponse(await mapRows(rows), pagination, Array.isArray(count) ? count.length : count);
    }
    const rows = await Model.findAll({ ...options, limit: UNPAGINATED_CAP });
    return mapRows(rows);
}

module.exports = {
    getListSearchParams,
    buildNamePhoneFilter,
    mergeWhere,
    parsePaginationParams,
    buildPaginatedResponse,
    escapeLike,
    likeContains,
    hasPaginationParams,
    parseOptionalPagination,
    UNPAGINATED_CAP,
    listWithOptionalPagination,
};
