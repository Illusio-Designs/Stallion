// Small allow-list HTML sanitiser for admin-written content (blog posts, policy pages, FAQ answers,
// product descriptions). It is applied when saving AND when serving, so a bad row can never reach a browser.
//
// Approach: tokenise the markup ourselves and rebuild it from scratch.
//  - only tags in ALLOWED_TAGS are kept, and only attributes in ALLOWED_ATTRS for that tag;
//  - script/style/iframe/object/embed/... are dropped together with everything inside them;
//  - every on* handler, style attribute and javascript:/vbscript:/data: URL is dropped;
//  - anything that is not a well formed tag (a stray "<") is escaped to text;
//  - links get rel="noopener noreferrer nofollow" (and target is limited to _blank).

const ALLOWED_TAGS = new Set([
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's',
    'blockquote', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'span', 'div', 'code', 'pre', 'sup', 'sub', 'small', 'mark',
]);
// Dropped WITH their content (not just the tag).
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'template',
    'svg', 'math', 'form', 'textarea', 'select', 'title', 'head', 'xmp', 'plaintext', 'noembed', 'noframes',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img']);
const ALLOWED_ATTRS = {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
};
const URL_ATTRS = new Set(['href', 'src']);

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n' };

// Decode entities enough to see through "java&#115;cript:" tricks before checking a URL.
function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
        if (e[0] === '#') {
            const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
        }
        const v = NAMED_ENTITIES[e.toLowerCase()];
        return v === undefined ? m : v;
    });
}

const escapeText = (s) => s.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Returns the decoded URL when it is http(s), mailto, tel, an anchor or a relative path; otherwise null.
function safeUrl(raw) {
    const decoded = decodeEntities(raw);
    // Browsers ignore control characters and whitespace inside a scheme, so check the squeezed form.
    const squeezed = decoded.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]+/g, '');
    if (!squeezed) return null;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(squeezed);
    if (scheme) return ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase()) ? decoded.trim() : null;
    if (squeezed.startsWith('//')) return null; // protocol-relative: could point anywhere, keep it explicit
    return decoded.trim();
}

// Parse the attribute string of a tag into [{name, value}].
function parseAttrs(src) {
    const out = [];
    const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let m;
    while ((m = re.exec(src))) {
        out.push({ name: m[1].toLowerCase(), value: m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '' });
    }
    return out;
}

function buildTag(tag, attrSrc) {
    const allowed = new Set([...(ALLOWED_ATTRS[tag] || []), ...ALLOWED_ATTRS['*']]);
    const kept = [];
    let target = null;
    for (const { name, value } of parseAttrs(attrSrc)) {
        if (name.startsWith('on') || !allowed.has(name)) continue;
        if (URL_ATTRS.has(name)) {
            const url = safeUrl(value);
            if (url) kept.push(`${name}="${escapeAttr(url)}"`);
            continue;
        }
        if (name === 'target') { target = value === '_blank' ? '_blank' : null; continue; }
        if (name === 'rel') continue; // we set our own
        if (name === 'class') {
            const cls = value.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
            if (cls) kept.push(`class="${escapeAttr(cls)}"`);
            continue;
        }
        if (['width', 'height', 'colspan', 'rowspan'].includes(name)) {
            if (/^\d{1,4}$/.test(value.trim())) kept.push(`${name}="${value.trim()}"`);
            continue;
        }
        if (name === 'loading') { if (value === 'lazy' || value === 'eager') kept.push(`loading="${value}"`); continue; }
        kept.push(`${name}="${escapeAttr(value.slice(0, 300))}"`);
    }
    if (tag === 'a') {
        if (target) kept.push('target="_blank"');
        kept.push('rel="noopener noreferrer nofollow"');
    }
    if (tag === 'img' && !kept.some((a) => a.startsWith('src='))) return ''; // an image without a safe source is useless
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`;
}

// Matches a comment, or a (possibly attribute-laden) tag. Quoted attribute values may contain ">".
const TOKEN_RE = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

function sanitizeHtml(input) {
    if (input === null || input === undefined) return '';
    let html = String(input).replace(/\u0000/g, '');
    if (html.length > 500000) html = html.slice(0, 500000);
    let out = '';
    let last = 0;
    const open = []; // stack of allowed, non-void tags we opened, so we can close any left open
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(html))) {
        out += escapeText(html.slice(last, m.index));
        last = TOKEN_RE.lastIndex;
        if (m[0].startsWith('<!--')) continue; // comments dropped
        const closing = m[1] === '/';
        const tag = m[2].toLowerCase();
        if (DROP_WITH_CONTENT.has(tag)) {
            if (!closing) {
                // skip everything up to the matching close tag (or to the end of input)
                const rest = html.slice(last);
                const cm = new RegExp(`</${tag}\\s*>`, 'i').exec(rest);
                last += cm ? cm.index + cm[0].length : rest.length;
                TOKEN_RE.lastIndex = last;
            }
            continue;
        }
        if (!ALLOWED_TAGS.has(tag)) continue; // unknown tag: drop the tag, keep its text
        if (closing) {
            const idx = open.lastIndexOf(tag);
            if (idx === -1) continue;
            while (open.length > idx) out += `</${open.pop()}>`;
        } else {
            const built = buildTag(tag, m[3] || '');
            if (!built) continue;
            out += built;
            if (!VOID_TAGS.has(tag)) open.push(tag);
        }
    }
    out += escapeText(html.slice(last));
    while (open.length) out += `</${open.pop()}>`;
    return out;
}

// Plain text of some HTML (for summaries, read time, feeds).
function htmlToText(input) {
    if (!input) return '';
    return decodeEntities(String(input)
        .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = { sanitizeHtml, htmlToText };
