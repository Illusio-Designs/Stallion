'use client';
import React, { useEffect, useRef, useState } from 'react';
import '../../styles/components/ui.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const key = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parse = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
};

/**
 * Custom single-date picker (calendar popover) — drop-in replacement for
 * <input type="date">. value/onChange use 'YYYY-MM-DD' strings.
 */
export default function DatePicker({ value, onChange, placeholder = 'Select date', disabled = false, min, max, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = parse(value);
  const today = new Date();
  const [view, setView] = useState(() => {
    const base = selected || { y: today.getFullYear(), m: today.getMonth() };
    return { y: base.y, m: base.m };
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Keep the visible month in sync when the value changes externally.
  useEffect(() => {
    if (selected) setView({ y: selected.y, m: selected.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedKey = selected ? key(selected.y, selected.m, selected.d) : null;

  const goPrev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const goNext = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const disabledDay = (k) => (min && k < min) || (max && k > max);

  const label = selected
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : placeholder;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(<div key={`b${i}`} className="cal__day cal__day--blank" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const k = key(view.y, view.m, d);
    const cls = ['cal__day'];
    if (k === selectedKey) cls.push('cal__day--start', 'cal__day--end');
    if (k === todayKey) cls.push('cal__day--today');
    const isDisabled = disabledDay(k);
    cells.push(
      <button
        type="button"
        key={k}
        className={cls.join(' ')}
        disabled={isDisabled}
        style={isDisabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
        onClick={() => { if (!isDisabled) { onChange?.(k); setOpen(false); } }}
      >
        <span>{d}</span>
      </button>
    );
  }

  return (
    <div ref={wrapRef} className={`ui-dropdown-custom ui-dropdown-custom--full-width ${disabled ? 'ui-dropdown-custom--disabled' : ''} ${className}`} style={{ position: 'relative' }}>
      <div className="ui-dropdown-custom__trigger" onClick={() => !disabled && setOpen((o) => !o)} role="button" tabIndex={disabled ? -1 : 0}>
        <span className={`ui-dropdown-custom__value ${!selected ? 'ui-dropdown-custom__value--placeholder' : ''}`}>{label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      {open && !disabled && (
        <div className="cal-popover" onMouseDown={(e) => e.stopPropagation()}>
          <div className="cal">
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
        </div>
      )}
    </div>
  );
}
