import React, { useState, useMemo } from 'react';
import '../styles/pages/dashboard-layout.css';
import DashboardHeader from '../components/DashboardHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardFooter from '../components/DashboardFooter';
import { useTokenMonitor } from '../hooks/useTokenMonitor';

const DashboardLayout = ({ children, currentPage, onPageChange }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Monitor token presence - automatically log out if token is removed
  useTokenMonitor(true);

  const layoutClassName = useMemo(() => {
    return isSidebarCollapsed ? 'collapsed' : 'expanded';
  }, [isSidebarCollapsed]);

  return (
    <div className={`dashboard-layout ${layoutClassName}`} style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
      <DashboardSidebar
        currentPage={currentPage}
        onPageChange={onPageChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
      />

      <div className="dashboard-shell">
        <DashboardHeader
          currentPage={currentPage}
          onPageChange={onPageChange}
          isCollapsed={isSidebarCollapsed}
        />

        <main className="dashboard-content">
          {children}
        </main>

        <DashboardFooter isCollapsed={isSidebarCollapsed} />
      </div>
    </div>
  );
};

export default DashboardLayout;
