'use client';
import React, { useEffect, useRef, useState } from 'react';
import '../../styles/components/ui.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const calKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const calParse = (k) => {
  if (!k) return null;
  const [y, m, d] = String(k).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
};
const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Range calendar: click start, then end; hover previews. Emits 'YYYY-MM-DD'.
function RangeCalendar({ from, to, onChange }) {
  const start = calParse(from);
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = start || { y: today.getFullYear(), m: today.getMonth() };
    return { y: base.y, m: base.m };
  });
  const [hover, setHover] = useState(null);

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayKey = calKey(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const goNext = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const handleClick = (k) => {
    if (!from || (from && to)) onChange({ from: k, to: null });
    else if (k < from) onChange({ from: k, to: from });
    else onChange({ from, to: k });
  };

  const previewEnd = to || (from && !to ? hover : null);
  const [lo, hi] = from && previewEnd ? (from <= previewEnd ? [from, previewEnd] : [previewEnd, from]) : [from, to];

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(<div key={`b${i}`} className="cal__day cal__day--blank" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const k = calKey(view.y, view.m, d);
    const isStart = lo && k === lo;
    const isEnd = hi && k === hi;
    const isInRange = lo && hi && k > lo && k < hi;
    const cls = ['cal__day'];
    if (isInRange) cls.push('cal__day--in-range');
    if (isStart) cls.push('cal__day--start');
    if (isEnd) cls.push('cal__day--end');
    if (k === todayKey) cls.push('cal__day--today');
    cells.push(
      <button type="button" key={k} className={cls.join(' ')} onClick={() => handleClick(k)} onMouseEnter={() => setHover(k)}>
        <span>{d}</span>
      </button>
    );
  }

  return (
    <div className="cal" onMouseLeave={() => setHover(null)}>
      <div className="cal__head">
        <button type="button" className="cal__nav" onClick={goPrev} aria-label="Previous month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="cal__title">{MONTHS[view.m]} {view.y}</div>
        <button type="button" className="cal__nav" onClick={goNext} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <div className="cal__grid cal__grid--wd">
        {WEEKDAYS.map((w) => <div key={w} className="cal__wd">{w}</div>)}
      </div>
      <div className="cal__grid">{cells}</div>
    </div>
  );
}

/**
 * Reusable date-range picker (pill trigger + range calendar popover).
 * Controlled via from/to ('YYYY-MM-DD'); onChange receives { from, to }.
 */
export default function DateRangePicker({ from = null, to = null, onChange, placeholder = 'Select dates', fullWidth = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const hasRange = Boolean(from || to);
  const label = hasRange ? `${fmt(from) || '…'} – ${fmt(to) || '…'}` : placeholder;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', width: fullWidth ? '100%' : undefined }}>
      <button type="button" className="ui-pill" onClick={() => setOpen((v) => !v)} title="Pick a date range" style={fullWidth ? { width: '100%', justifyContent: 'space-between' } : undefined}>
        <span style={{ color: hasRange ? 'var(--color-text)' : 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>{label}</span>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18, flexShrink: 0 }}>
          <path d="M8 2V5M16 2V5M3 9H21M5 5H19C20.105 5 21 5.895 21 7V19C21 20.105 20.105 21 19 21H5C3.895 21 3 20.105 3 19V7C3 5.895 3.895 5 5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="cal-popover" onMouseDown={(e) => e.stopPropagation()}>
          <RangeCalendar from={from} to={to} onChange={onChange} />
          <div className="cal__footer">
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => onChange({ from: null, to: null })}>Clear</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
