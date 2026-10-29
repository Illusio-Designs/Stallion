// India time (UTC+05:30, no daylight saving). The database stores UTC; reports and delivery dates use India days.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// UTC instant of 00:00 India time on the India day that contains `date`.
function istStartOfDay(date = new Date()) {
    const t = date.getTime();
    return new Date(Math.floor((t + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

// Start of the window "last N India days including today".
function istStartOfDaysAgo(days, now = new Date()) {
    return new Date(istStartOfDay(now).getTime() - (Math.max(1, days) - 1) * DAY_MS);
}

// India calendar date as "YYYY-MM-DD".
function istDateString(date = new Date()) {
    return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Parse a filter value. "2026-03-05" is an India day (start, or the start of the next day when `endOfDay`);
// a full ISO timestamp is used as is. Returns null when it is not a date.
function parseFilterDate(value, { endOfDay = false } = {}) {
    if (!value) return null;
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const start = new Date(`${s}T00:00:00.000Z`).getTime() - IST_OFFSET_MS;
        if (Number.isNaN(start)) return null;
        return new Date(start + (endOfDay ? DAY_MS : 0));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

// India date `n` delivery days after today. Sundays are not delivery days: they are skipped, never counted.
function addDeliveryDays(n, now = new Date()) {
    const d = new Date(now.getTime() + IST_OFFSET_MS); // read with the UTC getters = India wall clock
    let left = Math.max(0, Math.floor(n));
    while (left > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        if (d.getUTCDay() !== 0) left -= 1;
    }
    while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // n = 0 on a Sunday still moves to Monday
    return d.toISOString().slice(0, 10);
}

module.exports = { IST_OFFSET_MS, DAY_MS, istStartOfDay, istStartOfDaysAgo, istDateString, parseFilterDate, addDeliveryDays };
