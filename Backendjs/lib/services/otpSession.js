const OTP_SESSION_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, number>} phone -> expiresAt epoch ms */
const verifiedPhones = new Map();

function normalizePhone(phone) {
    return String(phone).replace(/[\s\-()]/g, '');
}

function markPhoneVerified(phone) {
    const key = normalizePhone(phone);
    verifiedPhones.set(key, Date.now() + OTP_SESSION_TTL_MS);
}

function consumePhoneVerification(phone) {
    const key = normalizePhone(phone);
    const expiresAt = verifiedPhones.get(key);
    if (!expiresAt || Date.now() > expiresAt) {
        verifiedPhones.delete(key);
        return false;
    }
    verifiedPhones.delete(key);
    return true;
}

function purgeExpiredSessions() {
    const now = Date.now();
    for (const [phone, expiresAt] of verifiedPhones.entries()) {
        if (expiresAt <= now) {
            verifiedPhones.delete(phone);
        }
    }
}

setInterval(purgeExpiredSessions, 60 * 1000).unref();

module.exports = {
    markPhoneVerified,
    consumePhoneVerification,
    normalizePhone,
};
