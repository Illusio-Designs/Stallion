const { Op } = require('sequelize');

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
function buildNamePhoneFilter({ name, phone, nameFields = [], phoneFields = [] }) {
    const conditions = [];

    if (name && nameFields.length > 0) {
        const term = `%${name}%`;
        conditions.push({
            [Op.or]: nameFields.map((field) => ({ [field]: { [Op.like]: term } })),
        });
    }

    if (phone && phoneFields.length > 0) {
        const term = `%${phone}%`;
        conditions.push({
            [Op.or]: phoneFields.map((field) => ({ [field]: { [Op.like]: term } })),
        });
    }

    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];
    return { [Op.and]: conditions };
}

function mergeWhere(baseWhere, searchFilter) {
    const hasBase = baseWhere && Object.keys(baseWhere).length > 0;
    const hasSearch = searchFilter && Object.keys(searchFilter).length > 0;
    if (!hasBase && !hasSearch) return {};
    if (!hasSearch) return baseWhere;
    if (!hasBase) return searchFilter;
    return { [Op.and]: [baseWhere, searchFilter] };
}

/** Required `page` and `limit` from query string. */
function parsePaginationParams(req) {
    const { page, limit } = req.query;
    if (!page || !limit) {
        return { error: 'Page and limit are required', status: 400 };
    }
    if (isNaN(page) || isNaN(limit)) {
        return { error: 'Page and limit must be numbers', status: 400 };
    }
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    return {
        page: pageNum,
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
    };
}

function buildPaginatedResponse(data, { page, limit }, count) {
    return {
        data,
        pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit) || 0,
        },
    };
}

module.exports = {
    getListSearchParams,
    buildNamePhoneFilter,
    mergeWhere,
    parsePaginationParams,
    buildPaginatedResponse,
};
