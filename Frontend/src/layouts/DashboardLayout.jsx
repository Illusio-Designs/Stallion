import React, { useState, useMemo, useEffect } from 'react';
import '../styles/pages/dashboard-layout.css';
import DashboardHeader from '../components/DashboardHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardFooter from '../components/DashboardFooter';
import { useTokenMonitor } from '../hooks/useTokenMonitor';

const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

const DashboardLayout = ({ children, currentPage, onPageChange }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Monitor token presence - automatically log out if token is removed
  useTokenMonitor(true);

  // Restore the persisted collapse state after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) setIsSidebarCollapsed(saved === 'true');
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((v) => {
      const next = !v;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  };

  const layoutClassName = useMemo(() => {
    return isSidebarCollapsed ? 'collapsed' : 'expanded';
  }, [isSidebarCollapsed]);

  return (
    <div className={`dashboard-layout ${layoutClassName}`}>
      <DashboardSidebar
        currentPage={currentPage}
        onPageChange={onPageChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div className="dashboard-shell">
        <DashboardHeader
          currentPage={currentPage}
          onPageChange={onPageChange}
          isCollapsed={isSidebarCollapsed}
        />

        <main className="dashboard-content page-enter" key={currentPage}>
          {children}
        </main>

        <DashboardFooter isCollapsed={isSidebarCollapsed} />
      </div>
    </div>
  );
};

export default DashboardLayout;
