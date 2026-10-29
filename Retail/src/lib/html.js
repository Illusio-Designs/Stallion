// Defence in depth for HTML bodies from the API. The backend already sanitises; this strips anything
// that could run script or load active content before we hand the string to dangerouslySetInnerHTML.
const TAGS = 'script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math';
const BLOCKED = new RegExp(`<\\s*(${TAGS})\\b[\\s\\S]*?(<\\s*\\/\\s*\\1\\s*>|$)`, 'gi');
const BLOCKED_SINGLE = new RegExp(`<\\s*\\/?\\s*(${TAGS})\\b[^>]*>`, 'gi');
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const BAD_URL_ATTR = /\s+(href|src|xlink:href|action|formaction)\s*=\s*("\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*'|(?:javascript|data|vbscript):[^\s>]*)/gi;
const STYLE_ATTR = /\s+style\s*=\s*("[^"]*"|'[^']*')/gi;

export function cleanHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  let prev;
  do { prev = out; out = out.replace(BLOCKED, ''); } while (out !== prev);
  out = out.replace(BLOCKED_SINGLE, '').replace(EVENT_ATTR, '').replace(BAD_URL_ATTR, '').replace(STYLE_ATTR, '');
  // external links open safely
  out = out.replace(/<a\s+([^>]*href\s*=\s*["']https?:\/\/[^>]*)>/gi, (m, attrs) => (/rel\s*=/.test(attrs) ? m : `<a ${attrs} rel="noopener noreferrer">`));
  return out;
}

export const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export const looksLikeHtml = (s) => /<[a-z][\s\S]*>/i.test(String(s || ''));
