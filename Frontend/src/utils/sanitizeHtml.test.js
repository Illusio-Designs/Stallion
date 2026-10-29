import { describe, it, expect } from 'vitest';
import { sanitizeHtml, isSafeHref, htmlToText } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('keeps simple formatting', () => {
    expect(sanitizeHtml('<h2>Hi</h2><p>a <strong>b</strong> <em>c</em></p><ul><li>x</li></ul>')).toBe('<h2>Hi</h2><p>a <strong>b</strong> <em>c</em></p><ul><li>x</li></ul>');
  });
  it('drops scripts, styles, iframes and their content', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe>');
    expect(out).toBe('<p>ok</p>');
  });
  it('removes event handlers and inline styles', () => {
    expect(sanitizeHtml('<p onclick="x()" style="color:red">t</p>')).toBe('<p>t</p>');
    expect(sanitizeHtml('<img src=x onerror=alert(1)>')).toBe('');
  });
  it('keeps safe links and drops javascript: links', () => {
    expect(sanitizeHtml('<a href="https://a.in/x">go</a>')).toContain('href="https://a.in/x"');
    expect(sanitizeHtml('<a href="https://a.in/x">go</a>')).toContain('rel="noopener noreferrer"');
    expect(sanitizeHtml('<a href="javascript:alert(1)">bad</a>')).toBe('bad');
    expect(sanitizeHtml('<a href=" JaVa\tScript:alert(1)">bad</a>')).toBe('bad');
  });
  it('maps divs and h1 to allowed tags', () => {
    expect(sanitizeHtml('<div>a</div><h1>t</h1>')).toBe('<p>a</p><h2>t</h2>');
  });
  it('treats an empty editor as empty', () => {
    expect(sanitizeHtml('<p><br></p>')).toBe('');
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
  });
  it('escapes text', () => expect(sanitizeHtml('<p>1 &lt; 2 &amp; 3</p>')).toBe('<p>1 &lt; 2 &amp; 3</p>'));
});

describe('isSafeHref', () => {
  it('accepts web, mail, phone and relative links only', () => {
    ['https://a.in', 'http://a.in', 'mailto:a@b.in', 'tel:+911234', '/shop', '#top'].forEach((h) => expect(isSafeHref(h)).toBe(true));
    ['javascript:x', 'data:text/html,x', 'vbscript:x', '', null].forEach((h) => expect(isSafeHref(h)).toBe(false));
  });
});

describe('htmlToText', () => {
  it('returns plain text', () => expect(htmlToText('<p>Hello <b>there</b></p>')).toBe('Hello there'));
});
