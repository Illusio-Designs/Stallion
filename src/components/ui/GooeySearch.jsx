import React, { useEffect, useRef, useState } from 'react';
import { FiSearch } from '../icons/hugeicons';

// A search box that rests as a round magnifying glass. Tapping it pulls a second blob out
// of the glass like liquid, and that blob becomes the text field. The two blobs and the
// stretchy neck between them are drawn as plain SVG shapes (no blur filter), so the edges
// stay crisp on every browser, including iPhones. It stays open while it holds text and
// closes by itself when emptied and left.
const R = 20; // radius of the round glass (the box is 40 px high)
const GAP = 10; // space between the glass and the field once open
const NECK = 15; // the neck only shows while the blobs are closer than this

const easeOutBack = (t) => { const c1 = 1.4; const c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

const shapes = (p, openWidth) => {
  const W = openWidth + 2 * R + GAP;
  const cx = W - R;
  const cy = R;
  const fx = cx - p * (2 * R + GAP);
  const wf = 2 * R + (openWidth - 2 * R) * Math.min(p, 1.04);
  const gap = (cx - fx) - 2 * R;
  let neck = null;
  if (p > 0 && gap > 0 && gap < NECK) {
    const t = R * (1 - gap / NECK);
    const xm = (fx + cx) / 2;
    const e = (cx - fx) * 0.35;
    neck = `M${fx},${cy - R} C${xm - e},${cy - t} ${xm + e},${cy - t} ${cx},${cy - R} L${cx},${cy + R} C${xm + e},${cy + t} ${xm - e},${cy + t} ${fx},${cy + R} Z`;
  }
  return { W, cx, cy, rectX: fx + R - wf, rectW: wf, neck, show: p > 0.001 };
};

const GooeySearch = ({ value, onChange, placeholder = 'Search...', label = 'Search', openWidth = 240, onSubmit, children, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const pRef = useRef(0);
  const text = value ?? '';
  const isOpen = open || !!text;

  useEffect(() => {
    const target = isOpen ? 1 : 0;
    const from = pRef.current;
    if (from === target) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { pRef.current = target; setP(target); return undefined; }
    const dur = isOpen ? 560 : 300;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const v = isOpen ? from + (1 - from) * easeOutBack(k) : from * (1 - easeInOut(k));
      pRef.current = k >= 1 ? target : v;
      setP(pRef.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 160);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target) && !text) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, text]);

  const toggle = () => {
    if (isOpen) { onChange?.(''); setOpen(false); } else { setOpen(true); }
  };

  const s = shapes(p, openWidth);

  return (
    <div
      ref={rootRef}
      className={`gsr${isOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--gsr-open': `${openWidth}px` }}
      role="search"
    >
      <svg className="gsr__svg" style={{ width: s.W, height: 2 * R, maxWidth: 'none' }} width={s.W} height={2 * R} viewBox={`0 0 ${s.W} ${2 * R}`} aria-hidden="true" focusable="false">
        {s.show && <rect x={s.rectX} y="0" width={s.rectW} height={2 * R} rx={R} />}
        {s.neck && <path d={s.neck} />}
        <circle cx={s.cx} cy={s.cy} r={R} />
      </svg>
      <form className="gsr__form" onSubmit={(e) => { e.preventDefault(); onSubmit?.(text); }}>
        <input
          ref={inputRef}
          type="text"
          className="gsr__input"
          placeholder={placeholder}
          aria-label={label}
          value={text}
          tabIndex={isOpen ? 0 : -1}
          autoComplete="off"
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { onChange?.(''); setOpen(false); } }}
        />
      </form>
      <button type="button" className="gsr__btn" onClick={toggle} aria-label={isOpen ? 'Close search' : label} aria-expanded={isOpen}>
        <FiSearch size={18} aria-hidden="true" />
      </button>
      {isOpen && text ? <div className="gsr__results">{children}</div> : null}
    </div>
  );
};

export default GooeySearch;
