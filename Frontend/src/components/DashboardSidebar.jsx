import React, { useMemo, useRef, useState, useEffect } from 'react';
import '../styles/components/DashboardSidebar.css';
import {
  FiGrid, FiPackage, FiShoppingCart, FiDollarSign, FiInbox, FiCalendar,
  FiUsers, FiUser, FiTruck, FiBriefcase, FiSliders, FiBarChart2,
  FiHelpCircle, FiSettings, FiChevronsLeft, FiX, FiShoppingBag, FiTag,
} from 'react-icons/fi';
import { getUserRole } from '../services/authService';
import { filterMenuItemsByRole } from '../utils/rolePermissions';

const DashboardSidebar = ({ onPageChange, currentPage, isCollapsed, onToggleCollapse, isMobileOpen = false, onMobileClose }) => {
  const [tooltipState, setTooltipState] = useState({ show: false, text: '', top: 0 });
  // Single crisp icon system (react-icons) — inherits currentColor (white on
  // the indigo sidebar), no webp + filter:brightness() hack.
  const sidebarIcons = {
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
  
  // Role comes from localStorage, which doesn't exist during SSR. Reading it
  // directly makes the server render the full menu and the client render the
  // role-filtered menu → hydration mismatch. Defer the role lookup until after
  // mount so the server and first client render agree (both show NO items),
  // then the role-filtered menu appears once mounted. Showing the full menu as
  // the fallback flashed the admin menu to non-admin users (e.g. a salesman saw
  // every item for a frame before it narrowed) — an empty list avoids that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const userRole = mounted ? getUserRole() : null;

  // All available menu items
  const allMenuItems = [
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
  
  // Filter menu items based on user role
  const menuItems = useMemo(() => {
    if (!userRole) return []; // before mount / no role: render nothing, not the admin menu
    return filterMenuItemsByRole(allMenuItems, userRole);
  }, [userRole]);

  return (
    <aside
      className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${
        isMobileOpen ? 'mobile-open max-md:translate-x-0' : 'max-md:-translate-x-full'
      } fixed left-0 top-0 z-[1000] flex h-screen flex-col overflow-visible bg-primary text-text-on-primary transition-transform duration-200 ease-[ease] motion-reduce:transition-none md:translate-x-0 ${
        isCollapsed ? 'w-16 md:w-16' : 'w-60'
      }`}
    >
      <div
        className={`dashboard-sidebar-header flex min-h-[var(--header-height)] items-center ${
          isCollapsed ? 'justify-center px-2 py-5' : 'justify-start px-4 py-3'
        }`}
      >
        <div className="sidebar-logo-wrap flex items-center">
          {isCollapsed ? (
            <img
              src="/faviconnotbg.png"
              alt="S logo"
              className="sidebar-logo-img h-8 w-8 max-w-full object-contain"
            />
          ) : (
            <img
              src="/images/logo/logo.webp"
              alt="Stallion Eyewear"
              className="sidebar-logo-img h-auto max-h-8 w-auto max-w-full object-contain"
            />
          )}
        </div>
        {/* Close (mobile drawer only) */}
        <button
          type="button"
          className="sidebar-mobile-close ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/[0.08] hover:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.7)] md:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <FiX size={20} aria-hidden="true" />
        </button>
      </div>

      <nav
        className={`dashboard-sidebar-nav min-h-0 flex-1 overflow-y-auto py-2 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] ${
          isCollapsed ? 'overflow-x-visible' : 'overflow-x-hidden'
        }`}
      >
        <ul className={`m-0 list-none overflow-visible ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {menuItems.map((item) => (
            <li key={item.id} className="relative mb-1 overflow-visible">
              <a
                href="#"
                className={`group relative flex items-center overflow-visible rounded-md text-white/80 no-underline transition-[background-color,color] duration-200 ease-[ease] outline-none hover:bg-white/[0.08] hover:text-text-on-primary focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.7)] active:scale-[0.98] motion-reduce:transition-none ${
                  isCollapsed
                    ? 'mx-auto h-11 w-11 justify-center p-0'
                    : 'min-h-10 gap-3 px-3 py-2'
                } ${
                  currentPage === item.id
                    ? isCollapsed
                      ? 'active bg-accent text-text-on-primary font-semibold'
                      : "active bg-white/[0.12] text-text-on-primary font-semibold before:absolute before:left-[-12px] before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-pill before:bg-accent before:content-['']"
                    : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(item.id);
                  onMobileClose?.();
                }}
                onMouseEnter={(e) => {
                  if (isCollapsed) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipState({
                      show: true,
                      text: item.text,
                      top: rect.top + rect.height / 2
                    });
                  }
                }}
                onMouseLeave={() => {
                  if (isCollapsed) {
                    setTooltipState({ show: false, text: '', top: 0 });
                  }
                }}
                aria-label={item.text}
              >
                <span className="sidebar-icon inline-flex h-5 w-5 flex-shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5 [&>svg]:flex-shrink-0">
                  {React.createElement(sidebarIcons[item.id] || FiGrid, { size: 20, 'aria-hidden': true })}
                </span>
                {!isCollapsed && (
                  <span className="sidebar-text whitespace-nowrap text-[length:var(--text-base)]">
                    {item.text}
                  </span>
                )}
                {isCollapsed && tooltipState.show && tooltipState.text === item.text && (
                  <span
                    className="sidebar-tooltip sidebar-tooltip--fixed fixed left-[76px] z-[10000] -translate-y-1/2 whitespace-nowrap rounded-sm bg-grey-900 px-2 py-1 text-[length:var(--text-xs)] text-text-on-primary shadow-md after:absolute after:left-[-5px] after:top-1/2 after:-translate-y-1/2 after:border-[5px] after:border-solid after:border-transparent after:border-r-grey-900 after:content-['']"
                    style={{ top: `${tooltipState.top}px` }}
                  >
                    {item.text}
                  </span>
                )}
              </a>
            </li>
          ))}
          {/* Back to Shop — lives in the drawer on mobile (the header button is
              hidden below md). A real CTA button (white fill on the indigo
              sidebar), not a flat nav row. */}
          <li className="mb-1 mt-3 md:hidden">
            {/* inline color: a global white sidebar-anchor rule outranks the
                Tailwind text-primary utility, so set the indigo text directly. */}
            <a
              href="/products"
              style={{ color: 'var(--color-primary)' }}
              className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[length:var(--text-sm)] font-semibold no-underline shadow-sm outline-none transition-[background-color,transform] duration-200 ease-[ease] hover:bg-white/90 focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.7)] active:scale-[0.98] motion-reduce:transition-none"
              onClick={() => onMobileClose?.()}
              aria-label="Back to Shop"
            >
              <FiShoppingBag size={18} aria-hidden="true" className="flex-shrink-0" />
              Back to Shop
            </a>
          </li>
        </ul>
      </nav>
      <div
        className={`dashboard-sidebar-footer border-t border-white/10 max-md:hidden ${
          isCollapsed ? 'px-2 py-3 text-center' : 'p-3'
        }`}
      >
        <button
          className={`sidebar-toggle flex min-h-10 w-full cursor-pointer items-center rounded-md border-none bg-transparent text-[length:var(--text-xs)] font-medium text-white/80 outline-none transition-[background-color,color] duration-200 ease-[ease] hover:bg-white/[0.08] hover:text-text-on-primary focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.7)] active:scale-[0.98] motion-reduce:transition-none ${
            isCollapsed ? 'justify-center gap-0 p-2' : 'justify-start gap-2 px-3 py-2'
          }`}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
        >
          <FiChevronsLeft
            aria-hidden="true"
            className={`sidebar-toggle__icon h-[18px] w-[18px] flex-shrink-0 transition-transform duration-300 ease-[ease] motion-reduce:transition-none ${
              isCollapsed ? 'rotate-180' : ''
            }`}
          />
          {!isCollapsed && (
            <span className="sidebar-toggle__label text-[length:var(--text-xs)]">Hide Sidebar</span>
          )}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
