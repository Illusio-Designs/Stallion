import React, { useEffect, useState } from 'react';
import { getCartCount, registerCartListener } from '../services/cartService';
import { isLoggedIn } from '../services/authService';
import { FiHome, FiShoppingBag, FiShoppingCart, FiUser } from './icons/hugeicons';

// Bottom navigation for the storefront on phones (hidden ≥ md). It uses the same
// look as the dashboard's bottom bar.
const ICONS = {
  home: <FiHome size={23} aria-hidden="true" />,
  shop: <FiShoppingBag size={23} aria-hidden="true" />,
  cart: <FiShoppingCart size={23} aria-hidden="true" />,
  user: <FiUser size={23} aria-hidden="true" />,
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
