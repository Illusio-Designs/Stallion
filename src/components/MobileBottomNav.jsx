import React, { useEffect, useState } from 'react';
import { getCartCount, registerCartListener } from '../services/cartService';
import { isLoggedIn } from '../services/authService';

// Bottom navigation for the storefront on phones (hidden ≥ md). It uses the same
// look as the dashboard's bottom bar.
const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  shop: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18l-1.5 11.5a1 1 0 0 1-1 .5H5.5a1 1 0 0 1-1-.5L3 9Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  cart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  ),
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const MobileBottomNav = ({ onPageChange, currentPage }) => {
  const [cartCount, setCartCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => { setLoggedIn(isLoggedIn()); }, [currentPage]);

  useEffect(() => {
    setCartCount(getCartCount());
    return registerCartListener(() => setCartCount(getCartCount()));
  }, []);

  const go = (id) => {
    if (onPageChange) onPageChange(id);
    else window.location.href = id ? `/${id}` : '/';
  };

  const items = [
    { key: 'home', id: '', label: 'Home', icon: ICONS.home, match: [''] },
    { key: 'shop', id: 'products', label: 'Shop', icon: ICONS.shop, match: ['products'] },
    { key: 'cart', id: 'cart', label: 'Cart', icon: ICONS.cart, match: ['cart'], badge: cartCount },
    {
      key: 'account',
      id: loggedIn ? 'dashboard' : 'login',
      label: 'Account',
      icon: ICONS.user,
      match: ['dashboard', 'login', 'profile'],
    },
  ];

  // Same bar as the dashboard (labelled icons, active item underlined): see .dashboard-bottom-nav.
  return (
    <nav className="dashboard-bottom-nav shop-bottom-nav md:hidden fixed z-[1000]" aria-label="Primary">
      {items.map((it) => {
        const active = it.match.includes(currentPage);
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => go(it.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={it.label}
            className="relative inline-flex flex-col items-center justify-center"
          >
            <span className="relative inline-flex">
              {it.icon}
              {it.badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-bold leading-none text-text-on-primary">
                  {it.badge > 99 ? '99+' : it.badge}
                </span>
              )}
            </span>
            <span className="dashboard-bottom-nav__label">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
