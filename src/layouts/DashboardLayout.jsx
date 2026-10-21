import React, { useState, useMemo, useEffect } from 'react';
import '../styles/pages/dashboard-layout.css';
import DashboardHeader from '../components/DashboardHeader';
import DashboardSidebar from '../components/DashboardSidebar';
import DashboardFooter from '../components/DashboardFooter';
import DashboardBottomNav from '../components/DashboardBottomNav';
import { useTokenMonitor } from '../hooks/useTokenMonitor';

const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

const DashboardLayout = ({ children, currentPage, onPageChange }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Off-canvas drawer (mobile only) — separate from the desktop collapse state.
  const [isMobile, setIsMobile] = useState(false);
  // Tablet (iPad portrait/landscape): the sidebar defaults to the icon rail so
  // the page keeps its width. The user can still expand it for this session.
  const [isTablet, setIsTablet] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
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
    // < 768px matches Tailwind's `md:` (>= 768px) so the two never overlap.
    const mq = window.matchMedia('(max-width: 767.98px)');
    const tq = window.matchMedia('(min-width: 768px) and (max-width: 1100px)');
    const update = () => {
      setIsMobile(mq.matches);
      setIsTablet(tq.matches);
      if (!mq.matches) setIsMobileSidebarOpen(false); // leaving mobile: ensure drawer closed
    };
    update();
    mq.addEventListener('change', update);
    tq.addEventListener('change', update);
    return () => {
      mq.removeEventListener('change', update);
      tq.removeEventListener('change', update);
    };
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
    // On tablets the toggle only affects this session; the saved desktop
    // preference is left alone.
    if (isTablet) {
      setTabletExpanded((v) => !v);
      return;
    }
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
  // On tablets it is the rail unless the user expanded it; on desktop it follows
  // the saved preference. Everything below (shell margin, header, footer) uses
  // this single value so the sidebar and content offset never disagree.
  const effectiveCollapsed = isMobile ? false : isTablet ? !tabletExpanded : isSidebarCollapsed;

  const layoutClassName = useMemo(() => {
    return effectiveCollapsed ? 'collapsed' : 'expanded';
  }, [effectiveCollapsed]);

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
          effectiveCollapsed ? 'md:ml-[76px]' : 'md:ml-60'
        }`}
      >
        <DashboardHeader
          currentPage={currentPage}
          onPageChange={onPageChange}
          isCollapsed={effectiveCollapsed}
          onMobileMenuToggle={openMobileSidebar}
          onToggleSidebar={toggleSidebar}
        />

        <main
          className="dashboard-content page-enter w-full max-w-[1440px] flex-1 mx-auto px-4 py-4 sm:py-5 md:p-6 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-6"
          key={currentPage}
        >
          {children}
        </main>

        {/* Footer is desktop-only; the floating bottom nav replaces it on phones. */}
        <div className="hidden md:block">
          <DashboardFooter isCollapsed={effectiveCollapsed} />
        </div>
      </div>

      {/* Phone bottom navigation (mirrors the storefront). Menu opens the drawer. */}
      <DashboardBottomNav
        currentPage={currentPage}
        onPageChange={onPageChange}
        onOpenMenu={openMobileSidebar}
      />
    </div>
  );
};

export default DashboardLayout;
