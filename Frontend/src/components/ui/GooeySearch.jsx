import React, { useEffect, useId, useRef, useState } from 'react';
import { FiSearch } from '../icons/hugeicons';

// A search box that rests as a round magnifying glass. Tapping it pulls a second blob out
// of the glass like liquid, and that blob becomes the text field. The blobs sit under a
// blur-and-threshold filter; the glass and the text are drawn above it, unfiltered.
// It stays open while it holds text and closes by itself when emptied and left.
const GooeySearch = ({ value, onChange, placeholder = 'Search...', label = 'Search', openWidth = 240, onSubmit, children, className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const filterId = `gsr-goo-${uid}`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const text = value ?? '';
  const isOpen = open || !!text;

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 120);
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

  return (
    <div
      ref={rootRef}
      className={`gsr${isOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--gsr-open': `${openWidth}px` }}
      role="search"
    >
      <svg width="0" height="0" className="gsr__defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g" />
            <feComposite in="SourceGraphic" in2="g" operator="atop" />
          </filter>
        </defs>
      </svg>
      <div className="gsr__goo" style={{ filter: `url(#${filterId})` }} aria-hidden="true">
        <span className="gsr__blob gsr__blob--field" />
        <span className="gsr__blob gsr__blob--btn" />
      </div>
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
