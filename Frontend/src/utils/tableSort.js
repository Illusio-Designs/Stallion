// Pure helpers for table sorting and searching (no React).

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const monthIndex = (name) => MONTHS[String(name).slice(0, 3).toLowerCase()];

// Build a UTC timestamp, rejecting impossible dates (e.g. 31/02).
function makeUTC(y, m, d, hh = 0, mm = 0, ss = 0) {
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m, d, hh, mm, ss);
  const dt = new Date(t);
  if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return t;
}

const TIME = "(?:[ T,]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\.\\d+)?\\s*([AaPp][Mm])?)?";
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const RE_NUMERIC = new RegExp(`^(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{4})${TIME}$`);
const RE_DMY_TEXT = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-]+([A-Za-z]{3,9})\\.?,?[\\s\\-]+(\\d{4})${TIME}$`);
const RE_MDY_TEXT = new RegExp(`^([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})${TIME}$`);

function timeParts(h, m, s, ap) {
  let hh = h ? parseInt(h, 10) : 0;
  if (ap) {
    const pm = ap.toLowerCase() === "pm";
    if (hh === 12) hh = pm ? 12 : 0;
    else if (pm) hh += 12;
  }
  return [hh, m ? parseInt(m, 10) : 0, s ? parseInt(s, 10) : 0];
}

export function isEmptyValue(v) {
  if (v == null) return true;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || /^[-–—]+$/.test(s) || /^(n\/a|null|undefined)$/i.test(s);
  }
  return false;
}

/**
 * Parse a date-like value to a timestamp (ms) or null.
 * Numbers are only treated as timestamps when allowNumber is true.
 * Slash/dash numeric dates are day-first (dd/mm/yyyy).
 */
export function parseDateValue(v, allowNumber = true) {
  if (v == null) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "number") {
    if (!allowNumber || !Number.isFinite(v) || v < 1e9) return null;
    return v < 1e11 ? v * 1000 : v; // seconds vs milliseconds
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  let m;
  if ((m = RE_ISO.exec(s))) {
    if (m[4] == null || !m[7]) {
      // date-only or local time: treat as UTC wall-clock for stable ordering
      const [hh, mm, ss] = [m[4], m[5], m[6]].map((x) => (x ? parseInt(x, 10) : 0));
      return makeUTC(+m[1], +m[2] - 1, +m[3], hh, mm, ss);
    }
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  if ((m = RE_NUMERIC.exec(s))) {
    const [hh, mm, ss] = timeParts(m[4], m[5], m[6], m[7]);
    return makeUTC(+m[3], +m[2] - 1, +m[1], hh, mm, ss);
  }
  if ((m = RE_DMY_TEXT.exec(s))) {
    const mo = monthIndex(m[2]);
    if (mo === undefined) return null;
    const [hh, mm, ss] = timeParts(m[4], m[5], m[6], m[7]);
    return makeUTC(+m[3], mo, +m[1], hh, mm, ss);
  }
  if ((m = RE_MDY_TEXT.exec(s))) {
    const mo = monthIndex(m[1]);
    if (mo === undefined) return null;
    const [hh, mm, ss] = timeParts(m[4], m[5], m[6], m[7]);
    return makeUTC(+m[3], mo, +m[2], hh, mm, ss);
  }
  return null;
}

/** Parse "₹1,25,000", "3 Orders", "12.5%", 42 ... to a number or null. */
export function parseNumberValue(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  s = s.replace(/^(?:₹|Rs\.?|INR|\$|USD|€|£)\s*/i, "");
  if (s.startsWith("-") || s.startsWith("+")) {
    // allow sign before or after currency symbol
    const sign = s[0];
    s = s.slice(1).trim().replace(/^(?:₹|Rs\.?|INR|\$|USD|€|£)\s*/i, "");
    if (sign === "-") neg = !neg;
  }
  s = s.replace(/,/g, "");
  const m = /^(\d+\.?\d*|\.\d+)\s*(?:%|[A-Za-z][A-Za-z .]*)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/**
 * Decide how a column should be sorted from its raw values:
 * "date" when most non-empty values are dates, "number" when most are numeric,
 * otherwise "text".
 */
export function detectColumnType(rows, key) {
  let total = 0, dates = 0, nums = 0;
  const list = rows || [];
  for (let i = 0; i < list.length && total < 200; i++) {
    const v = list[i]?.[key];
    if (isEmptyValue(v)) continue;
    total++;
    if (parseDateValue(v, false) != null) dates++;
    else if (parseNumberValue(v) != null) nums++;
  }
  if (!total) return "text";
  if (dates / total > 0.5) return "date";
  if (nums / total > 0.5) return "number";
  return "text";
}

const textCmp = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

/**
 * Compare two raw cell values. direction: "asc" | "desc".
 * type: "auto" | "date" | "number" | "text" (use detectColumnType for a column).
 * Empty / "-" / null values always sort last, regardless of direction.
 */
export function compareValues(a, b, direction = "asc", type = "auto") {
  const ea = isEmptyValue(a);
  const eb = isEmptyValue(b);
  if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1;
  const sign = direction === "desc" ? -1 : 1;

  const tryKind = (kind) => {
    const parse =
      kind === "date" ? (x) => parseDateValue(x, type === "date") : parseNumberValue;
    const pa = parse(a);
    const pb = parse(b);
    if (pa != null && pb != null) return pa - pb;
    // In a typed column, parseable values come before unparseable ones.
    if (type === kind) {
      if (pa != null) return -1 / sign;
      if (pb != null) return 1 / sign;
      return textCmp(a, b);
    }
    return null;
  };

  let r = null;
  if (type === "date" || type === "auto") r = tryKind("date");
  if (r == null && (type === "number" || type === "auto")) r = tryKind("number");
  if (r == null) r = textCmp(a, b);
  return r === 0 ? 0 : sign * r;
}

function primitiveText(v) {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  const t = typeof v;
  if (t === "string") return v;
  if (t === "number" || t === "boolean") return String(v);
  return ""; // objects / arrays / React elements are not stringified
}

/**
 * Lower-cased searchable text built only from the given (visible) columns.
 * Uses the column's render output when it is plain text/number, else the raw
 * row value for that column key.
 */
export function visibleSearchText(row, columns) {
  if (!row) return "";
  const parts = [];
  for (const c of columns || []) {
    const raw = row[c.key];
    let text = "";
    if (typeof c.render === "function") {
      try {
        const out = c.render(raw, row);
        if (typeof out === "string" || typeof out === "number") text = String(out);
        else text = primitiveText(raw);
      } catch {
        text = primitiveText(raw);
      }
    } else {
      text = primitiveText(raw);
    }
    if (text) parts.push(text);
  }
  return parts.join(" \u0001 ").toLowerCase();
}
