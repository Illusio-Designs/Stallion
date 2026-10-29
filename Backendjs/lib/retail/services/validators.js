// Input cleaning shared by the public retail endpoints. Nothing here touches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Trim, drop control characters, cap the length. Empty -> null. Non-strings -> null.
function cleanText(value, max) {
    if (typeof value !== 'string') return null;
    // eslint-disable-next-line no-control-regex
    const s = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (!s) return null;
    return s.slice(0, max);
}

// "+91 98765 43210", "919876543210", "09876543210" and "9876543210" are the same Indian mobile number.
function normalizePhone(value) {
    let d = String(value == null ? '' : value).replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d;
}
const isValidPhone = (digits) => /^[6-9]\d{9}$/.test(digits);

const normalizePincode = (value) => String(value == null ? '' : value).replace(/\s/g, '');
const isValidPincode = (pin) => /^[1-9]\d{5}$/.test(pin);

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const isSessionId = (v) => typeof v === 'string' && SESSION_RE.test(v);
const isEmail = (v) => typeof v === 'string' && v.length <= 190 && EMAIL_RE.test(v);

// Money helpers: all arithmetic is done in whole paise so 0.1 + 0.2 style errors never reach a bill.
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const fromPaise = (paise) => Math.round(paise) / 100;

// "https://l.facebook.com/x?y" -> "facebook". Unknown hosts stay as the bare host without "www.".
function sourceFromHost(host) {
    const h = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!h) return null;
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/(^|\.)bing\.com$/.test(h)) return 'bing';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
    if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(h)) return 'youtube';
    if (/(^|\.)(t\.co|twitter\.com|x\.com)$/.test(h)) return 'twitter';
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(h)) return 'whatsapp';
    return h.slice(0, 120);
}

// Traffic source of a visit: explicit utm_source wins, then the referrer's host, else 'direct'.
function resolveSource(utmSource, referrer) {
    if (utmSource) return String(utmSource).toLowerCase().slice(0, 120);
    if (referrer) {
        try { return sourceFromHost(new URL(referrer).hostname) || 'direct'; } catch (_e) { /* not a URL */ }
    }
    return 'direct';
}

// Landing page as a bare path: "https://x.in/blog/a?utm=1#top" and "/blog/a?utm=1" -> "/blog/a".
function cleanPath(value) {
    const s = cleanText(value, 1000);
    if (!s) return null;
    let p = s;
    if (/^https?:\/\//i.test(s)) {
        try { p = new URL(s).pathname; } catch (_e) { return null; }
    }
    p = p.split('#')[0].split('?')[0];
    if (!p.startsWith('/')) return null;
    return p.slice(0, 500);
}

// Referrer without query string or fragment (those can carry tokens), or null.
function cleanReferrer(value) {
    const s = cleanText(value, 1000);
    if (!s) return null;
    try {
        const u = new URL(s);
        if (!/^https?:$/.test(u.protocol)) return null;
        return `${u.origin}${u.pathname}`.slice(0, 500);
    } catch (_e) {
        return null;
    }
}

// Crawlers, uptime monitors and scripted clients: their tracking pings are ignored. A missing UA counts as a bot.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|scrapy|curl\/|wget|python-requests|httpclient|go-http|java\/|node-fetch|axios|postman/i;
const isBot = (userAgent) => !userAgent || BOT_RE.test(String(userAgent));

module.exports = {
    cleanText, normalizePhone, isValidPhone, normalizePincode, isValidPincode,
    isUuid, isSessionId, isEmail, toPaise, fromPaise, resolveSource, cleanPath, cleanReferrer, isBot,
};
