const crypto = require('crypto');

const ORDER_PREFIX = 'ORD';
const TOTAL_LENGTH = 10;
const RANDOM_LENGTH = TOTAL_LENGTH - ORDER_PREFIX.length;
const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a new unique order number with format "ORDxxxxxxx" (10 chars total).
 * @param {Iterable<string>} existingOrderNumbers - Collection of already used order numbers.
 * @returns {string} Unique order number.
 */
function generateUniqueOrderNumber(existingOrderNumbers = []) {
    const existingSet = new Set(existingOrderNumbers);
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
        const candidate = `${ORDER_PREFIX}${randomAlphaNumeric(RANDOM_LENGTH)}`;
        if (!existingSet.has(candidate)) {
            return candidate;
        }
        attempts += 1;
    }

    throw new Error('Unable to generate unique order number after max attempts');
}

function randomAlphaNumeric(length) {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i += 1) {
        const index = bytes[i] % ALPHANUMERIC_CHARS.length;
        result += ALPHANUMERIC_CHARS[index];
    }
    return result;
}

module.exports = {
    generateUniqueOrderNumber,
};
