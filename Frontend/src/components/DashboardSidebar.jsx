import React, { useMemo, useRef, useState, useEffect } from 'react';
import '../styles/components/DashboardSidebar.css';
import { FiUsers, FiSliders, FiInbox, FiCalendar } from 'react-icons/fi';
import { getUserRole } from '../services/authService';
import { filterMenuItemsByRole } from '../utils/rolePermissions';

const DashboardSidebar = ({ onPageChange, currentPage, isCollapsed, onToggleCollapse }) => {
  const [tooltipState, setTooltipState] = useState({ show: false, text: '', top: 0 });
  const sidebarIcons = {
    dashboard: '/images/icons/Dashboard.webp',
    'dashboard-products': '/images/icons/Products.webp',
    orders: '/images/icons/Orders.webp',
    expenses: '/images/icons/bank-note-01.webp',
    party: '/images/icons/Clients.webp',
    salesmen: '/images/icons/user-circle.webp',
    distributor: '/images/icons/Supplier.webp',
    'office-team': '/images/icons/user-circle.webp',
    manage: '/images/icons/menu.webp',
    analytics: '/images/icons/Analytics.webp',
    support: '/images/icons/Support.webp',
    settings: '/images/icons/Setting.webp',
  };
  const reactSidebarIcons = {
    salesmen: FiUsers,
    manage: FiSliders,
    tray: FiInbox,
    events: FiCalendar,
  };
  
  // Get user role
  const userRole = getUserRole();
  
  // All available menu items
  const allMenuItems = [
    { id: 'dashboard', text: 'Dashboard' },
    { id: 'dashboard-products', text: 'Products' },
    { id: 'orders', text: 'Orders' },
    { id: 'expenses', text: 'Expenses' },
    { id: 'tray', text: 'Tray' },
    { id: 'events', text: 'Events' },
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
    if (!userRole) return allMenuItems; // If no role, show all (fallback)
    return filterMenuItemsByRole(allMenuItems, userRole);
  }, [userRole]);

  return (
    <aside
      className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : 'expanded'} fixed left-0 top-0 z-[1000] flex h-screen flex-col overflow-visible bg-primary text-text-on-primary ${
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
                <span className="sidebar-icon inline-flex h-5 w-5 flex-shrink-0 items-center justify-center [&>img]:block [&>img]:h-5 [&>img]:w-5 [&>img]:object-contain [&>img]:[filter:brightness(0)_invert(1)] [&>svg]:h-5 [&>svg]:w-5 [&>svg]:flex-shrink-0">
                  {reactSidebarIcons[item.id] ? (
                    React.createElement(reactSidebarIcons[item.id], { size: 20 })
                  ) : (
                    <img src={sidebarIcons[item.id]} alt={item.text} />
                  )}
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
        </ul>
      </nav>
      <div
        className={`dashboard-sidebar-footer border-t border-white/10 ${
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
          <img
            src="/images/icons/hideshow.webp"
            alt=""
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
