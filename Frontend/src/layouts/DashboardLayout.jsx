import React, { useState, useMemo, useEffect } from 'react';
import '../styles/pages/dashboard-layout.css';
import DashboardHeader from '../components/DashboardHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardFooter from '../components/DashboardFooter';
import { useTokenMonitor } from '../hooks/useTokenMonitor';

const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

const DashboardLayout = ({ children, currentPage, onPageChange }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Off-canvas drawer (mobile only) — separate from the desktop collapse state.
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Monitor token presence - automatically log out if token is removed
  useTokenMonitor(true);

  // Restore the persisted collapse state after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) setIsSidebarCollapsed(saved === 'true');
  }, []);

  // Track viewport so the sidebar renders as a drawer (expanded labels) on mobile.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setIsMobileSidebarOpen(false); // leaving mobile: ensure drawer closed
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Close the drawer whenever the page changes (a nav item was picked).
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [currentPage]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const locked = isMobile && isMobileSidebarOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isMobileSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((v) => {
      const next = !v;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  };

  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);
  const openMobileSidebar = () => setIsMobileSidebarOpen(true);

  // On mobile the drawer always shows full labels (never the collapsed rail).
  const effectiveCollapsed = isMobile ? false : isSidebarCollapsed;

  const layoutClassName = useMemo(() => {
    return isSidebarCollapsed ? 'collapsed' : 'expanded';
  }, [isSidebarCollapsed]);

  return (
    <div className={`dashboard-layout ${layoutClassName} flex min-h-screen bg-surface-muted text-text`}>
      <DashboardSidebar
        currentPage={currentPage}
        onPageChange={onPageChange}
        isCollapsed={effectiveCollapsed}
        onToggleCollapse={toggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />

      {/* Backdrop — only on mobile while the drawer is open */}
      <div
        className={`dashboard-sidebar-backdrop fixed inset-0 z-[999] bg-black/45 transition-opacity duration-200 md:hidden ${
          isMobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeMobileSidebar}
        aria-hidden="true"
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
          onMobileMenuToggle={openMobileSidebar}
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
