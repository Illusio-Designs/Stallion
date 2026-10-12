// Binds an OTP proof to the phone number it was issued for.
//
// MSG91's "verify access token" call answers { type: 'success', message: '<identifier>' },
// where the identifier is the phone number (or email) that really received and
// confirmed the OTP, e.g. '919999999999'. A login must only succeed when that
// identifier is the phone number being logged in; otherwise someone could verify
// THEIR OWN phone and present that proof for somebody else's number.

const digitsOf = (v) => String(v == null ? '' : v).replace(/\D/g, '');

/**
 * @param {string} identifier  what MSG91 says was verified (e.g. '919999999999')
 * @param {string} phoneNumber the phone the caller wants to log in as (e.g. '+919999999999')
 * @returns {boolean} true only when they are the same phone number
 */
function identifierMatchesPhone(identifier, phoneNumber) {
    const raw = String(identifier == null ? '' : identifier).trim();
    // An email (or anything that is not a phone number) can never match a phone login.
    if (!raw || raw.includes('@')) return false;
    const a = digitsOf(raw);
    const b = digitsOf(phoneNumber);
    if (a.length < 10 || b.length < 10) return false;
    if (a === b) return true;
    // One side may carry the country code and the other not: compare the national number.
    return a.slice(-10) === b.slice(-10) && (a.length === 10 || b.length === 10);
}

// Escape hatch: set OTP_ALLOW_UNBOUND_TOKEN=true on the server ONLY if MSG91 stops
// returning the identifier and logins fail; it restores the old, weaker behaviour.
const allowUnboundToken = () => String(process.env.OTP_ALLOW_UNBOUND_TOKEN || '').toLowerCase() === 'true';

module.exports = { identifierMatchesPhone, allowUnboundToken };
