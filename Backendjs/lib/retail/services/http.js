// Small helpers shared by the retail controllers: the response envelope from API_CONTRACT.md,
// an error type that carries an HTTP status, and a route wrapper that turns any throw into the envelope.
const { hit, clientIp } = require('../../utils/rateLimiter');

class HttpError extends Error {
    // `extra` is merged into the JSON body (e.g. { issues } for a 422, { errors } for a 400)
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

const ok = (res, data, status = 200, extra = {}) => res.status(status).json({ success: true, data, ...extra });

// Wrap an async controller: HttpError -> its status, anything else -> 500 with a generic message
// (details go to the server log only, never to the browser).
const route = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) {
            return res.status(err.status).json({ success: false, message: err.message, ...err.extra });
        }
        console.error(`[retail] ${req.method} ${req.originalUrl} failed:`, err);
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
};

// Fixed-window rate limit that answers in the contract envelope (lib/utils/rateLimiter.js `limit`
// answers { error }, which the storefront would not show). Same counters, same client IP rule.
const rateLimit = ({ name, max, windowMs, message, keys }) => (req, res, next) => {
    for (const k of keys ? keys(req) : [clientIp(req)]) {
        if (!k) continue;
        const r = hit(`${name}:${k}`, max, windowMs);
        if (!r.ok) {
            res.set('Retry-After', String(r.retryAfterSec));
            return res.status(429).json({ success: false, message: message || 'Too many requests. Please try again shortly.' });
        }
    }
    next();
};

module.exports = { HttpError, ok, route, rateLimit, clientIp };
