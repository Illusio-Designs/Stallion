// Small in-memory fixed-window limiter. Enough to stop SMS-bombing and code
// guessing on a single server process; counters reset on restart.
const buckets = new Map(); // key -> { count, resetAt }

const clientIp = (req) => {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return fwd || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
};

// Digits only, last 10: "+91 98765 43210", "919876543210" and "9876543210" count as one number.
const phoneKey = (req) => String((req.body && req.body.phoneNumber) || '').replace(/\D/g, '').slice(-10);

// Count one hit. Returns { ok, retryAfterSec }.
function hit(key, max, windowMs) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
    }
    if (b.count >= max) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
    }
    b.count += 1;
    return { ok: true, retryAfterSec: 0 };
}

// Check without counting.
function blocked(key, max) {
    const b = buckets.get(key);
    if (!b || b.resetAt <= Date.now()) return { ok: true, retryAfterSec: 0 };
    return b.count >= max
        ? { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000)) }
        : { ok: true, retryAfterSec: 0 };
}

const clear = (key) => buckets.delete(key);

const deny = (res, retryAfterSec, message) => {
    res.set('Retry-After', String(retryAfterSec));
    const mins = Math.ceil(retryAfterSec / 60);
    return res.status(429).json({
        error: `${message} Please try again in ${retryAfterSec < 90 ? `${retryAfterSec} seconds` : `${mins} minutes`}.`,
        retry_after_seconds: retryAfterSec,
    });
};

// Express middleware: at most `max` requests per `windowMs` for each key.
const limit = ({ name, max, windowMs, keys, message }) => (req, res, next) => {
    for (const k of keys(req)) {
        if (!k) continue;
        const r = hit(`${name}:${k}`, max, windowMs);
        if (!r.ok) return deny(res, r.retryAfterSec, message);
    }
    next();
};

setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60 * 1000).unref();

module.exports = { hit, blocked, clear, deny, limit, clientIp, phoneKey };
