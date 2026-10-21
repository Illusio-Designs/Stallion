import React, { useEffect, useMemo, useState } from 'react';
import {
  FiGrid, FiPackage, FiShoppingCart, FiDollarSign, FiInbox, FiCalendar,
  FiUsers, FiUser, FiTruck, FiBriefcase, FiSliders, FiBarChart2,
  FiHelpCircle, FiSettings, FiTag, FiMenu,
} from 'react-icons/fi';
import { getUserRoles } from '../services/authService';
import { filterMenuItemsByRoles } from '../utils/rolePermissions';

// Floating pill-style bottom navigation for the dashboard on phones
// (hidden ≥ md), mirroring the storefront nav. Shows the top role-allowed
// destinations plus a "Menu" button that opens the full sidebar drawer.
const ICONS = {
  dashboard: FiGrid,
  'dashboard-products': FiPackage,
  orders: FiShoppingCart,
  expenses: FiDollarSign,
  tray: FiInbox,
  events: FiCalendar,
  offers: FiTag,
  party: FiUsers,
  salesmen: FiUser,
  distributor: FiTruck,
  'office-team': FiBriefcase,
  manage: FiSliders,
  analytics: FiBarChart2,
  support: FiHelpCircle,
  settings: FiSettings,
};

const ALL_ITEMS = [
  { id: 'dashboard', text: 'Dashboard' },
  { id: 'dashboard-products', text: 'Products' },
  { id: 'orders', text: 'Orders' },
  { id: 'expenses', text: 'Expenses' },
  { id: 'tray', text: 'Sample' },
  { id: 'events', text: 'Events' },
  { id: 'offers', text: 'Offers' },
  { id: 'party', text: 'Party' },
  { id: 'salesmen', text: 'Salesmen' },
  { id: 'distributor', text: 'Distributor' },
  { id: 'office-team', text: 'Office Team' },
  { id: 'manage', text: 'Manage' },
  { id: 'analytics', text: 'Analytics & Reports' },
  { id: 'support', text: 'Support' },
  { id: 'settings', text: 'Settings' },
];

// Short labels for the compact pill.
const SHORT = { 'dashboard-products': 'Products', analytics: 'Reports', 'office-team': 'Team' };

const DashboardBottomNav = ({ onPageChange, currentPage, onOpenMenu }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Union of every role the member holds (multi-role support).
  const userRoles = mounted ? getUserRoles() : [];
  const rolesKey = userRoles.join(',');

  const primary = useMemo(() => {
    const items = userRoles.length ? filterMenuItemsByRoles(ALL_ITEMS, userRoles) : ALL_ITEMS;
    return items.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey]);

  const go = (id) => { if (onPageChange) onPageChange(id); };

  return (
    <nav
      className="dashboard-bottom-nav md:hidden fixed z-[1000]"
      aria-label="Dashboard"
    >
      {primary.map((it) => {
        const active = currentPage === it.id;
        const Icon = ICONS[it.id] || FiGrid;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => go(it.id)}
            aria-current={active ? 'page' : undefined}
            aria-label={it.text}
            className="relative inline-flex flex-col items-center justify-center"
          >
            <Icon size={21} aria-hidden="true" />
            <span className="dashboard-bottom-nav__label">{SHORT[it.id] || it.text}</span>
          </button>
        );
      })}
      {/* Menu — opens the full sidebar drawer with every destination. */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="inline-flex flex-col items-center justify-center"
      >
        <FiMenu size={21} aria-hidden="true" />
        <span className="dashboard-bottom-nav__label">Menu</span>
      </button>
    </nav>
  );
};

export default DashboardBottomNav;
