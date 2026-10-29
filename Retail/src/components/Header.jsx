'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '../lib/cart';
import ThemeSwitch from './ThemeSwitch';

const NAV = [['Shop', '/shop'], ['Blog', '/blog'], ['About', '/about'], ['Contact', '/contact'], ['Help', '/help']];

export default function Header({ storeName = 'Stallion', wholesaleUrl = '' }) {
  const path = usePathname() || '/';
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <header className="hd">
      <div className="wrap hd__in">
        <button type="button" className="ib hd__menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>&#9776;</button>
        <Link href="/" className="logo">{storeName.toUpperCase()}</Link>
        <nav className="nav" aria-label="Main">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} aria-current={path === href || path.startsWith(href + '/') ? 'page' : undefined}>{label}</Link>
          ))}
        </nav>
        <span className="hd__sp" />
        {wholesaleUrl ? <a className="hd__b2b" href={wholesaleUrl}>Wholesale for opticians &#8594;</a> : null}
        <ThemeSwitch />
        <Link href="/cart" className="ib" aria-label={`Cart, ${count} items`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6L5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>
          {count > 0 && <span className="ib__n">{count}</span>}
        </Link>
      </div>
      {open && (
        <div className="drawer"><div className="wrap">
          {NAV.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link href="/track" onClick={() => setOpen(false)}>Track order</Link>
          {wholesaleUrl ? <a href={wholesaleUrl}>Wholesale for opticians</a> : null}
        </div></div>
      )}
    </header>
  );
}
