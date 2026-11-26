'use client';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { suggestAddress, addressDetails } from '../../services/api/partnersApi';
import '../../styles/redesign-n-address.css';

// Address box with Google suggestions while typing. Typing by hand always works: when the
// server has no Google key (or Google is slow) the box is a plain multi-line field.
// onPick receives the picked address with its pincode and the ids of its country, state
// and city (missing ones are added on the server).
const newSession = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export default function AddressAutocomplete({ value, onChange, onPick, placeholder = 'Start typing the shop address', id, showStatus = false }) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(''); // why suggestions are missing (shown to admins)
  const session = useRef(newSession());
  const enabled = useRef(true);
  const typed = useRef(false); // suggestions only after the person types, not after a pick or a fill
  const timer = useRef(null);
  const wrap = useRef(null);
  const areaRef = useRef(null);
  const listRef = useRef(null);
  const [pos, setPos] = useState(null); // where the list is drawn, in screen coordinates

  useEffect(() => {
    if (!typed.current || !enabled.current) return undefined;
    const text = String(value || '').trim();
    if (text.length < 3) { setItems([]); setOpen(false); return undefined; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await suggestAddress(text, session.current);
        if (res?.configured === false) { enabled.current = false; setItems([]); setOpen(false); setStatus('Google address search is not set up on the server yet (GOOGLE_MAPS_API_KEY is missing). Type the address by hand.'); return; }
        if (res?.unavailable) { setStatus(`Google address search is not working: ${res.reason || 'no answer from Google'}. Type the address by hand.`); } else { setStatus(''); }
        const list = Array.isArray(res?.suggestions) ? res.suggestions : [];
        setItems(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        setItems([]); setOpen(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [value]);

  useEffect(() => {
    const away = (e) => {
      const inside = (wrap.current && wrap.current.contains(e.target)) || (listRef.current && listRef.current.contains(e.target));
      if (!inside) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  // The list is drawn on the page itself (not inside the side panel), so the panel's footer or its
  // scrolling can never hide it. It opens below the box, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewH = vv ? vv.height + vv.offsetTop : window.innerHeight; // the phone keyboard shrinks the visible area
      const below = viewH - r.bottom - 8;
      const above = r.top - 8;
      const up = below < 200 && above > below;
      setPos({
        left: r.left,
        width: r.width,
        top: up ? 'auto' : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : 'auto',
        maxHeight: Math.max(120, Math.min(320, up ? above : below)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); };
  }, [open, items.length]);

  const choose = async (item) => {
    setOpen(false);
    typed.current = false;
    setBusy(true);
    try {
      const d = await addressDetails(item.place_id, session.current);
      session.current = newSession();
      if (d?.address) onPick?.({ ...d, suggestion_main: item.main || '' });
      else onChange?.(item.text || '');
    } catch {
      onChange?.(item.text || '');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="addr-ac" ref={wrap}>
      <textarea
        id={id}
        ref={areaRef}
        className="ui-input addr-ac__input"
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { typed.current = true; onChange?.(e.target.value); }}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {busy && <span className="addr-ac__busy" role="status">Filling in the address...</span>}
      {showStatus && status && <span className="addr-ac__status" role="status">{status}</span>}
      {open && items.length > 0 && pos && typeof document !== 'undefined' && createPortal(
        <ul className="addr-ac__list" id={listId} role="listbox" ref={listRef} style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}>
          {items.map((it, i) => (
            <li
              key={it.place_id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`addr-ac__item${i === active ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(it)}
            >
              <b>{it.main || it.text}</b>
              {it.secondary && <span>{it.secondary}</span>}
            </li>
          ))}
          <li className="addr-ac__credit" aria-hidden="true">Powered by Google</li>
        </ul>,
        document.body,
      )}
    </div>
  );
}
