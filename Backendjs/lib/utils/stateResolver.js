const State = require('../models/State');
const { Op } = require('sequelize');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a list of state identifiers (each may be a State UUID OR a state name,
 * case-insensitive) into a de-duplicated array of State UUIDs.
 * Throws an error with statusCode 404 if any value can't be matched.
 *
 * @param {Array<string>} values
 * @returns {Promise<string[]>} array of state ids
 */
async function resolveStateIds(values) {
    const out = [];
    for (const raw of (values || [])) {
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;
        const v = String(raw).trim();
        const where = UUID_RE.test(v)
            ? { id: v }
            : { name: { [Op.iLike]: v } };
        const state = await State.findOne({ where });
        if (!state) {
            const err = new Error(`State not found: ${v}`);
            err.statusCode = 404;
            throw err;
        }
        if (!out.includes(state.id)) out.push(state.id);
    }
    return out;
}

/** Resolve a single state id-or-name to its State id (or null). */
async function resolveStateId(value) {
    const ids = await resolveStateIds([value]);
    return ids[0] || null;
}

module.exports = { resolveStateIds, resolveStateId };
