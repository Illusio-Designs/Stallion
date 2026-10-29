'use client';
import React, { useEffect, useRef, useState } from 'react';
import { sanitizeHtml, isSafeHref } from '../../utils/sanitizeHtml';
import '../../styles/redesign-p-retail.css';
import '../../styles/dark-retail.css';

/**
 * A small rich text area for blog posts: bold, italic, headings, lists and links.
 * `value` and `onChange` are sanitised HTML (see utils/sanitizeHtml), so what is saved is always safe.
 * Pasting keeps plain text only, so styles from Word or a web page never come along.
 */
const TOOLS = [
  { id: 'bold', label: 'Bold', cmd: 'bold', content: <b>B</b> },
  { id: 'italic', label: 'Italic', cmd: 'italic', content: <i>I</i> },
  { id: 'h2', label: 'Heading', cmd: 'formatBlock', arg: 'H2', content: 'H2' },
  { id: 'h3', label: 'Subheading', cmd: 'formatBlock', arg: 'H3', content: 'H3' },
  { id: 'p', label: 'Paragraph', cmd: 'formatBlock', arg: 'P', content: '¶' },
  { id: 'ul', label: 'Bulleted list', cmd: 'insertUnorderedList', content: '• List' },
  { id: 'ol', label: 'Numbered list', cmd: 'insertOrderedList', content: '1. List' },
];

export default function RichTextEditor({ value, onChange, placeholder = 'Write the article here', label = 'Article body' }) {
  const ref = useRef(null);
  const lastEmitted = useRef(null);
  const savedRange = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('https://');
  const [linkErr, setLinkErr] = useState('');
  const [empty, setEmpty] = useState(!value);

  // Put the value in only when it came from outside (opening another post), not after every keystroke.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastEmitted.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value || '';
      setEmpty(!value);
    }
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    lastEmitted.current = clean;
    setEmpty(clean === '');
    onChange(clean);
  };

  const exec = (cmd, arg) => {
    ref.current?.focus();
    try { document.execCommand(cmd, false, arg); } catch { /* the browser does not support this command */ }
    emit();
  };

  const rememberSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount && ref.current && ref.current.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  const openLink = () => {
    rememberSelection();
    setLinkErr('');
    setHref('https://');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = href.trim();
    if (!isSafeHref(url) || url === 'https://') { setLinkErr('Enter a web address that starts with https://'); return; }
    ref.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      try { document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`); } catch { /* unsupported */ }
    } else {
      try { document.execCommand('createLink', false, url); } catch { /* unsupported */ }
    }
    setLinkOpen(false);
    emit();
  };
  const removeLink = () => { exec('unlink'); };

  return (
    <div className="rt-rte">
      <div className="rt-rte__bar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="rt-rte__btn" title={t.label} aria-label={t.label} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(t.cmd, t.arg)}>{t.content}</button>
        ))}
        <button type="button" className="rt-rte__btn" title="Add link" aria-label="Add link" onMouseDown={(e) => { rememberSelection(); e.preventDefault(); }} onClick={openLink}>Link</button>
        <button type="button" className="rt-rte__btn" title="Remove link" aria-label="Remove link" onMouseDown={(e) => e.preventDefault()} onClick={removeLink}>Unlink</button>
      </div>
      {linkOpen && (
        <div className="rt-rte__link">
          <input
            className="ui-input"
            value={href}
            aria-label="Link address"
            onChange={(e) => { setHref(e.target.value); setLinkErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { e.stopPropagation(); setLinkOpen(false); } }}
            autoFocus
          />
          <button type="button" className="ui-btn ui-btn--primary" onClick={applyLink}>Add link</button>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setLinkOpen(false)}>Cancel</button>
          {linkErr && <p className="rt-error" role="alert">{linkErr}</p>}
        </div>
      )}
      <div className="rt-rte__wrap">
        {empty && <span className="rt-rte__ph" aria-hidden="true">{placeholder}</span>}
        <div
          ref={ref}
          className="rt-rte__area"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          spellCheck
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
            try { document.execCommand('insertText', false, text); } catch { /* unsupported */ }
            emit();
          }}
        />
      </div>
    </div>
  );
}
