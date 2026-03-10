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
    <aside className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="dashboard-sidebar-header">
        <div className="sidebar-logo-wrap" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {isCollapsed ? (
            <img src="/faviconnotbg.png" alt="S logo" className="sidebar-logo-img" />
          ) : (
            <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="sidebar-logo-img" />
          )}
        </div>
      </div>

      <nav className="dashboard-sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.id}>
              <a
                href="#"
                className={currentPage === item.id ? 'active' : ''}
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
                <span className="sidebar-icon">
                  {reactSidebarIcons[item.id] ? (
                    React.createElement(reactSidebarIcons[item.id], { size: 20 })
                  ) : (
                    <img src={sidebarIcons[item.id]} alt={item.text} />
                  )}
                </span>
                {!isCollapsed && <span className="sidebar-text">{item.text}</span>}
                {isCollapsed && tooltipState.show && tooltipState.text === item.text && (
                  <span 
                    className="sidebar-tooltip sidebar-tooltip--fixed"
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
      <div className="dashboard-sidebar-footer">
        <button className="sidebar-toggle" onClick={onToggleCollapse} style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : 8, background: 'none', border: 'none', cursor: 'pointer', width: '100%', justifyContent: isCollapsed ? 'center' : 'start' }}>
          <img src="/images/icons/hideshow.webp" alt="Toggle Sidebar" style={{ width: 18, height: 18, transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
          {!isCollapsed && <span style={{ fontSize: '12px' }}>Hide Sidebar</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
