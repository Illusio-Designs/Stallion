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
    <div className={`dashboard-layout ${layoutClassName} flex min-h-screen bg-surface-muted text-text`}>
      <DashboardSidebar
        currentPage={currentPage}
        onPageChange={onPageChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div
        className={`dashboard-shell flex min-h-screen min-w-0 flex-1 flex-col ml-0 transition-[margin-left] duration-200 ease-[ease] motion-reduce:transition-none ${
          isSidebarCollapsed ? 'md:ml-16' : 'md:ml-60'
        }`}
      >
        <DashboardHeader
          currentPage={currentPage}
          onPageChange={onPageChange}
          isCollapsed={isSidebarCollapsed}
        />

        <main
          className="dashboard-content page-enter w-full max-w-[1440px] flex-1 mx-auto px-4 py-4 sm:py-5 md:p-6"
          key={currentPage}
        >
          {children}
        </main>

        <DashboardFooter isCollapsed={isSidebarCollapsed} />
      </div>
    </div>
  );
};

export default DashboardLayout;
