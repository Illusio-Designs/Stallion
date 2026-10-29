'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClient } from '../lib/api';
import { rs } from '../lib/format';

// Search box for the shop. Works without JavaScript as a plain GET form; with it, shows up to 6 suggestions.
export default function SearchSuggest({ initial = '' }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const seq = useRef(0);

  useEffect(() => { setQ(initial); }, [initial]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setItems([]); return undefined; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await getClient(`/search/suggest?q=${encodeURIComponent(term)}`);
        if (id === seq.current) { setItems(Array.isArray(res.data) ? res.data.slice(0, 6) : []); setActive(-1); }
      } catch (_e) { if (id === seq.current) setItems([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setOpen(false);
    const term = q.trim();
    if (active >= 0 && items[active]) { router.push(`/shop/${items[active].slug}`); return; }
    router.push(term ? `/shop?search=${encodeURIComponent(term)}` : '/shop');
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % items.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
  };
  const show = open && items.length > 0;

  return (
    <form className="sg" action="/shop" method="get" role="search" onSubmit={submit} ref={box}>
      <label className="sr" htmlFor={`${listId}-in`}>Search frames</label>
      <input
        id={`${listId}-in`}
        className="input sg__in"
        type="search"
        name="search"
        value={q}
        placeholder="Search frames, shapes, colours"
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      <button type="submit" className="btn btn--pri sg__go">Search</button>
      {show && (
        <ul className="sg__list" id={listId} role="listbox">
          {items.map((it, i) => (
            <li key={it.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <Link href={`/shop/${it.slug}`} className={i === active ? 'is-on' : ''} onClick={() => setOpen(false)}>
                <span className="sg__ph">{it.image ? <img src={it.image} alt="" loading="lazy" /> : null}</span>
                <span className="sg__t">{it.title}</span>
                <b>{rs(it.mrp)}</b>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
