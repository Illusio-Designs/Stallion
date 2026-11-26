const crypto = require('crypto');

const OTP_SESSION_TTL_MS = 2 * 60 * 1000;

/** @type {Map<string, {expiresAt:number, ticket:string}>} phone -> verification */
const verifiedPhones = new Map();

function normalizePhone(phone) {
    return String(phone).replace(/[\s\-()]/g, '');
}

function markPhoneVerified(phone) {
    const key = normalizePhone(phone);
    // A random one-time ticket is handed back to the person who actually passed the
    // OTP. Login without an access token must present it, so knowing the phone
    // number alone is not enough to log in during the window.
    const ticket = crypto.randomBytes(24).toString('hex');
    verifiedPhones.set(key, { expiresAt: Date.now() + OTP_SESSION_TTL_MS, ticket });
    return ticket;
}

function consumePhoneVerification(phone, ticket) {
    const key = normalizePhone(phone);
    const v = verifiedPhones.get(key);
    if (!v || Date.now() > v.expiresAt) {
        verifiedPhones.delete(key);
        return false;
    }
    const given = Buffer.from(String(ticket || ''));
    const want = Buffer.from(v.ticket);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
        return false; // wrong ticket: keep the real one alive for its owner
    }
    verifiedPhones.delete(key);
    return true;
}

function purgeExpiredSessions() {
    const now = Date.now();
    for (const [phone, v] of verifiedPhones.entries()) {
        if (v.expiresAt <= now) {
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
