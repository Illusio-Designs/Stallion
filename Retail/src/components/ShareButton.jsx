'use client';
import { useState } from 'react';

// Copies the current page address. Uses the clipboard API with a textarea fallback.
export default function ShareButton({ label = 'Copy link' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    const url = window.location.href;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (_e) { /* fall through */ }
    if (!ok) {
      try {
        const t = document.createElement('textarea');
        t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); document.body.removeChild(t);
      } catch (_e) { ok = false; }
    }
    if (ok) { setDone(true); setTimeout(() => setDone(false), 2200); }
  }
  return (
    <span className="art__share">
      <button type="button" className="btn" onClick={copy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
        {done ? 'Link copied' : label}
      </button>
      <span className="sr" role="status" aria-live="polite">{done ? 'Link copied to clipboard' : ''}</span>
    </span>
  );
}
