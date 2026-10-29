import React, { useMemo, useRef, useState, useEffect } from 'react';
import '../styles/components/DashboardSidebar.css';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';
import {
  FiGrid, FiPackage, FiShoppingCart, FiInbox, FiCalendar,
  FiUsers, FiUser, FiTruck, FiBriefcase, FiSliders, FiBarChart2,
  FiHelpCircle, FiSettings, FiChevronsLeft, FiX, FiShoppingBag, FiTag,
  FiEdit, FiSearch, FiBox,
} from './icons/hugeicons';
import RupeeIcon from './icons/RupeeIcon';
import { getUserRoles } from '../services/authService';
import { filterMenuItemsByRoles } from '../utils/rolePermissions';
import { retailMenuFor } from '../utils/retailSide';
import { useRetailAccess } from '../hooks/useRetailAccess';

const DashboardSidebar = ({ onPageChange, currentPage, isCollapsed, onToggleCollapse, isMobileOpen = false, onMobileClose }) => {
  const [tooltipState, setTooltipState] = useState({ show: false, text: '', top: 0 });
  // Tooltips label the icons in the collapsed rail. Mouse hover and keyboard
  // focus show them directly; on touch (iPad) a long-press shows one for a
  // moment and does not navigate.
  const pressTimer = useRef(null);
  const hideTimer = useRef(null);
  const longPressed = useRef(false);
  const showTip = (el, text) => {
    const rect = el.getBoundingClientRect();
    setTooltipState({ show: true, text, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTooltipState({ show: false, text: '', top: 0 });
  const tipHandlers = (text) => ({
    onMouseEnter: (e) => { if (isCollapsed) showTip(e.currentTarget, text); },
    onMouseLeave: () => { if (isCollapsed) hideTip(); },
    onFocus: (e) => { if (isCollapsed) showTip(e.currentTarget, text); },
    onBlur: () => { if (isCollapsed) hideTip(); },
    onTouchStart: (e) => {
      if (!isCollapsed) return;
      const el = e.currentTarget;
      longPressed.current = false;
      clearTimeout(hideTimer.current);
      pressTimer.current = setTimeout(() => {
        longPressed.current = true;
        showTip(el, text);
      }, 400);
    },
    onTouchEnd: () => {
      clearTimeout(pressTimer.current);
      if (longPressed.current) {
        hideTimer.current = setTimeout(hideTip, 1500);
      }
    },
    onTouchMove: () => clearTimeout(pressTimer.current),
    onTouchCancel: () => { clearTimeout(pressTimer.current); hideTip(); },
  });
  useEffect(() => () => { clearTimeout(pressTimer.current); clearTimeout(hideTimer.current); }, []);
  // Single crisp icon system (react-icons) — inherits currentColor (white on
  // the indigo sidebar), no webp + filter:brightness() hack.
  const sidebarIcons = {
    dashboard: FiGrid,
    'dashboard-products': FiPackage,
    orders: FiShoppingCart,
    expenses: RupeeIcon,
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
    shop: FiShoppingBag,
    // Retail (store) side
    retail: FiGrid,
    'retail-orders': FiShoppingBag,
    'retail-frames': FiBox,
    'retail-blog': FiEdit,
    'retail-seo': FiSearch,
    'retail-shipping': FiTruck,
    'retail-analytics': FiBarChart2,
    'retail-settings': FiSettings,
    'retail-roles': FiUsers,
  };
  const { side } = useRetailAccess(currentPage);
  
  // Role comes from localStorage, which doesn't exist during SSR. Reading it
  // directly makes the server render the full menu and the client render the
  // role-filtered menu → hydration mismatch. Defer the role lookup until after
  // mount so the server and first client render agree (both show the full menu),
  // then the filtered menu appears once mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // A member can hold several roles — unlock the union of every role's pages.
  const userRoles = mounted ? getUserRoles() : [];

  // All available menu items
  // In the order people work: home, the shop, then orders and parties, then the rest.
  const allMenuItems = [
    { id: 'dashboard', text: 'Dashboard' },
    { id: 'orders', text: 'Orders' },
    { id: 'party', text: 'Parties' },
    { id: 'expenses', text: 'Expenses' },
    { id: 'dashboard-products', text: 'Products' },
    { id: 'tray', text: 'Sample trays' },
    { id: 'events', text: 'Events' },
    { id: 'offers', text: 'Offers' },
    { id: 'salesmen', text: 'Salesmen' },
    { id: 'distributor', text: 'Distributors' },
    { id: 'office-team', text: 'Office team' },
    { id: 'manage', text: 'Manage' },
    { id: 'analytics', text: 'Reports' },
    { id: 'support', text: 'Support' },
    { id: 'settings', text: 'Settings' },
  ];

  
  // Filter menu items based on the union of the user's roles
  const rolesKey = userRoles.join(',');
  const menuItems = useMemo(() => {
    // The Retail side has its own, shorter menu. The Wholesale menu below is exactly what it always was.
    if (side === 'retail') return retailMenuFor(userRoles);
    const list = userRoles.length ? filterMenuItemsByRoles(allMenuItems, userRoles) : allMenuItems; // no role: show all (fallback)
    // The shop is a row of this menu too, right after the Dashboard (there is no separate shop navigation).
    const at = list.findIndex((it) => it.id === 'dashboard');
    return [...list.slice(0, at + 1), { id: 'shop', text: 'Shop' }, ...list.slice(at + 1)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, side]);

  return (
    <aside
      className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} ${
        isMobileOpen ? 'mobile-open max-md:translate-x-0' : 'max-md:-translate-x-full'
      } fixed left-0 top-0 z-[1000] flex h-dvh flex-col overflow-visible bg-surface text-text border-r border-border transition-transform duration-200 ease-[ease] motion-reduce:transition-none md:translate-x-0 ${
        isCollapsed ? 'w-[76px] md:w-[76px]' : 'w-60'
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
          className="sidebar-mobile-close ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-grey-100 hover:text-text focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(0,0,0,0.3)] md:hidden"
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
        {side === 'retail' && !isCollapsed && <p className="rt-side-label">Retail store</p>}
        <ul className={`m-0 list-none overflow-visible ${isCollapsed ? 'px-2' : 'px-3'}`}>
          {menuItems.map((item) => (
            <li key={item.id} className="relative mb-1 overflow-visible">
              <a
                href="#"
                className={`group relative flex items-center overflow-visible rounded-md text-text-muted no-underline transition-[background-color,color] duration-200 ease-[ease] outline-none hover:bg-grey-100 hover:text-text focus-visible:shadow-[0_0_0_2px_rgba(0,0,0,0.3)] active:scale-[0.98] motion-reduce:transition-none ${
                  isCollapsed
                    ? 'mx-auto h-11 w-11 justify-center p-0'
                    : 'min-h-10 gap-3 px-3 py-2'
                } ${
                  (currentPage === item.id || (item.id === 'shop' && ['products', 'product-detail', 'cart'].includes(currentPage)))
                    ? isCollapsed
                      ? 'active bg-accent text-text-on-primary font-semibold'
                      : "active bg-primary text-text-on-primary font-semibold before:absolute before:left-[-12px] before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-pill before:bg-accent before:content-['']"
                    : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  // A long-press only shows the label; it must not navigate.
                  if (longPressed.current) { longPressed.current = false; return; }
                  hideTip();
                  onPageChange(item.id === 'shop' ? 'products' : item.id);
                  onMobileClose?.();
                }}
                {...tipHandlers(item.text)}
                style={{ WebkitTouchCallout: 'none' }}
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
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div
        className={`dashboard-sidebar-footer border-t border-border max-md:hidden ${
          isCollapsed ? 'px-2 py-3 text-center' : 'p-3'
        }`}
      >
        <button
          className={`sidebar-toggle flex min-h-10 w-full cursor-pointer items-center rounded-md border-none bg-transparent text-[length:var(--text-xs)] font-medium text-text-muted outline-none transition-[background-color,color] duration-200 ease-[ease] hover:bg-grey-100 hover:text-text focus-visible:shadow-[0_0_0_2px_rgba(0,0,0,0.3)] active:scale-[0.98] motion-reduce:transition-none ${
            isCollapsed ? 'justify-center gap-0 p-2' : 'justify-start gap-2 px-3 py-2'
          }`}
          onClick={() => { hideTip(); onToggleCollapse(); }}
          {...tipHandlers('Expand sidebar')}
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
      {isCollapsed && tooltipState.show && (
        <span
          role="tooltip"
          className="sidebar-tooltip sidebar-tooltip--fixed pointer-events-none fixed left-[84px] z-[10000] -translate-y-1/2 whitespace-nowrap rounded-sm bg-grey-900 px-2 py-1 text-[length:var(--text-xs)] text-text-on-primary shadow-md after:absolute after:left-[-5px] after:top-1/2 after:-translate-y-1/2 after:border-[5px] after:border-solid after:border-transparent after:border-r-grey-900 after:content-['']"
          style={{ top: `${tooltipState.top}px` }}
        >
          {tooltipState.text}
        </span>
      )}
    </aside>
  );
};

export default DashboardSidebar;
