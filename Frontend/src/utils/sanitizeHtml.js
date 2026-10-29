// Allow-list HTML sanitiser for the blog editor. Keeps simple formatting and drops everything else
// (scripts, styles, event handlers, javascript: links). The server sanitises again; this keeps the
// editor honest and the preview safe.

const ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE']);
// Removed with everything inside them.
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'TEXTAREA', 'SELECT', 'HEAD', 'TITLE', 'META', 'LINK']);
// Browsers turn these into the allowed ones.
const RENAME = { DIV: 'P', H1: 'H2', H5: 'H4', H6: 'H4' };

const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

/** True for a link target we are willing to keep. */
export const isSafeHref = (href) => {
  const h = String(href || '').trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  return h !== '' && SAFE_HREF.test(h);
};

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// No DOM (server render): drop every tag, keep the text.
const stripTags = (html) => escapeText(String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ''));

function clean(node, doc) {
  const out = doc.createDocumentFragment();
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) { out.appendChild(doc.createTextNode(child.nodeValue)); return; }
    if (child.nodeType !== 1) return;
    let tag = child.tagName.toUpperCase();
    if (DROP_WITH_CONTENT.has(tag)) return;
    tag = RENAME[tag] || tag;
    const inner = clean(child, doc);
    if (!ALLOWED.has(tag)) { out.appendChild(inner); return; } // unknown wrapper: keep its text
    const el = doc.createElement(tag.toLowerCase());
    if (tag === 'A') {
      const href = child.getAttribute('href');
      if (!isSafeHref(href)) { out.appendChild(inner); return; }
      el.setAttribute('href', href.trim());
      if (/^https?:/i.test(href.trim())) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
    }
    el.appendChild(inner);
    out.appendChild(el);
  });
  return out;
}

/** Sanitised HTML string. Empty editor content (<p><br></p>) comes back as ''. */
export function sanitizeHtml(html) {
  const input = String(html ?? '');
  if (!input.trim()) return '';
  if (typeof DOMParser === 'undefined') return stripTags(input);
  const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html');
  const holder = doc.createElement('div');
  holder.appendChild(clean(doc.body, doc));
  const result = holder.innerHTML.trim();
  const plain = holder.textContent.replace(/ /g, ' ').trim();
  return plain === '' && !/<(ul|ol)/i.test(result) ? '' : result;
}

/** Plain text of some HTML, for read-time and summaries. */
export function htmlToText(html) {
  if (typeof DOMParser === 'undefined') return stripTags(html);
  const doc = new DOMParser().parseFromString(`<body>${String(html ?? '')}</body>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}
