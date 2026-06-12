'use client';
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import AuthLayout from '../layouts/AuthLayout';
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import Loader from '../components/Loader';
import '../styles/globals.css';
// Eager-load shared + dashboard page styles so they apply on first paint.
// The dashboard page JS stays lazy; only the (small) CSS is loaded upfront,
// which avoids the unstyled-content flash when a lazy page chunk renders.
import '../styles/components/ui.css';
import '../styles/pages/dashboard-layout.css';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-products.css';
import '../styles/pages/dashboard-orders.css';
import '../styles/pages/dashboard-clients.css';
import '../styles/pages/dashboard-suppliers.css';
import '../styles/pages/dashboard-analytics.css';
import '../styles/pages/dashboard-expenses.css';
import '../styles/pages/dashboard-settings.css';
import '../styles/pages/dashboard-support.css';
import { getUserRole, isLoggedIn } from '../services/authService';
import { hasPageAccess } from '../utils/rolePermissions';
import { pageKeyToPath, pathToDashboardPage, isDashboardPage, parseProductPath } from '../utils/dashboardRoutes';

// Auth + Public pages are imported eagerly so their CSS ships in the main
// bundle and is applied on first paint (no unstyled flash on reload / direct
// navigation). Dashboard pages stay lazy (behind auth) to keep this bundle lean.
import Login from './Login';
import Register from './Register';
import Home from './Home';
import About from './About';
import Cart from './Cart';
import Products from './Products';
import ProductDetail from './ProductDetail';
import PrivacyPolicy from './PrivacyPolicy';

// Dashboard Pages - lazy loaded
const Dashboard = lazy(() => import('./Dashboard'));
const DashboardProducts = lazy(() => import('./DashboardProducts'));
const DashboardOrders = lazy(() => import('./DashboardOrders'));
const DashboardClients = lazy(() => import('./DashboardClients'));
const DashboardSuppliers = lazy(() => import('./DashboardSuppliers'));
const DashboardDistributor = lazy(() => import('./DashboardDistributor'));
const DashboardOfficeTeam = lazy(() => import('./DashboardOfficeTeam'));
const DashboardManage = lazy(() => import('./DashboardManage'));
const DashboardTray = lazy(() => import('./DashboardTray'));
const DashboardEvents = lazy(() => import('./DashboardEvents'));
const AnalyticsReports = lazy(() => import('./AnalyticsReports'));
const DashboardSupport = lazy(() => import('./DashboardSupport'));
const DashboardSettings = lazy(() => import('./DashboardSettings'));
const DashboardExpenses = lazy(() => import('./DashboardExpenses'));

const App = ({ initialPage = 'home', productId: initialProductId = null }) => {
  const router = useRouter();
  
  // Get page from URL on mount and when props change
  const getPageFromUrl = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      // Dashboard pages use nested routes (/dashboard/products, ...).
      const dashboardPage = pathToDashboardPage(path);
      if (dashboardPage) {
        // Back-compat: honor a legacy ?tab= on the bare /dashboard route.
        if (path.replace(/\/+$/, '') === '/dashboard' && params.get('tab')) {
          return params.get('tab');
        }
        return dashboardPage;
      }
      // Clean product detail route: /product/<model_no>
      if (parseProductPath(path)) {
        return 'product-detail';
      }
      const page = path.slice(1);
      return page === '' ? '' : page;
    }
    return initialPage;
  };
  
  // Get productId from URL on mount and when props change
  const getProductIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      return id ? parseInt(id) : null;
    }
    return initialProductId;
  };
  
  // Helper to determine layout from page
  const getLayoutFromPage = (page) => {
    if (['login', 'register'].includes(page)) {
      return 'auth';
    } else if (isDashboardPage(page)) {
      return 'dashboard';
    }
    return 'public';
  };

  const [currentPage, setCurrentPage] = useState(() => {
    // Use initialPage if provided, otherwise try to get from URL
    return initialPage || getPageFromUrl();
  });
  const [currentProductId, setCurrentProductId] = useState(() => {
    // Use initialProductId if provided, otherwise try to get from URL
    return initialProductId !== null ? initialProductId : getProductIdFromUrl();
  });
  const [currentLayout, setCurrentLayout] = useState(() => {
    // Initialize layout based on initial page
    const page = initialPage || getPageFromUrl();
    return getLayoutFromPage(page);
  });

  // Sync with prop changes (which come from URL changes)
  useEffect(() => {
    if (initialPage && initialPage !== currentPage) {
      setCurrentPage(initialPage);
    }
    if (initialProductId !== null && initialProductId !== currentProductId) {
      setCurrentProductId(initialProductId);
    }
  }, [initialPage, initialProductId]);

  // Update URL when page or layout changes
  const handlePageChange = (page, productId = null) => {
    if (page === currentPage && productId === currentProductId) return;
    // Dashboard pages -> nested routes (/dashboard/products, ...);
    // public pages keep their flat route. See utils/dashboardRoutes.
    const url = pageKeyToPath(page, productId);
    router.push(url, { scroll: false });
    
    // Determine layout based on page
    const layout = getLayoutFromPage(page);

    setCurrentPage(page);
    setCurrentProductId(productId);
    setCurrentLayout(layout);
  };

  const renderPage = () => {
    // Check if this is a dashboard page that requires role-based access
    const dashboardPages = ['dashboard', 'dashboard-products', 'orders', 'tray', 'events', 'party', 'salesmen', 'distributor', 'office-team', 'manage', 'analytics', 'support', 'settings', 'expenses'];
    const isDashboardPage = dashboardPages.includes(currentPage);
    
    // If it's a dashboard page, check role-based access
    if (isDashboardPage && isLoggedIn()) {
      const userRole = getUserRole();
      if (userRole && !hasPageAccess(userRole, currentPage)) {
        // User doesn't have access to this page, redirect to settings (which most roles have) or first accessible page
        const accessiblePages = ['settings', 'dashboard-products', 'orders', 'tray', 'events', 'party', 'salesmen', 'distributor', 'analytics'];
        for (const page of accessiblePages) {
          if (hasPageAccess(userRole, page)) {
            setTimeout(() => {
              handlePageChange(page);
            }, 100);
            return <div style={{ padding: '20px', textAlign: 'center' }}>Redirecting...</div>;
          }
        }
        // If no accessible page found, show error
        return <div style={{ padding: '20px', textAlign: 'center' }}>You don't have access to this page.</div>;
      }
    }
    
    switch (currentPage) {
      // Auth Pages
      case 'login':
        return <Login onPageChange={handlePageChange} />;
      case 'register':
        return <Register />;
      
      // Public Pages
      case '':
        return <Home onPageChange={handlePageChange} />;
      case 'products':
        return <Products onPageChange={handlePageChange} />;
      case 'product-detail':
        return <ProductDetail productId={currentProductId || initialProductId} />;
      case 'about':
        return <About />;
      case 'privacy-policy':
        return <PrivacyPolicy />;
      case 'cart':
        return <Cart onPageChange={handlePageChange} />;
      
      // Dashboard Pages
      case 'dashboard':
        return <Dashboard />;
      case 'dashboard-products':
        return <DashboardProducts />;
      case 'orders':
        return <DashboardOrders />;
      case 'tray':
        return <DashboardTray />;
      case 'events':
        return <DashboardEvents />;
      case 'party':
        return <DashboardClients />;
      case 'salesmen':
        return <DashboardSuppliers />;
      case 'distributor':
        return <DashboardDistributor />;
      case 'office-team':
        return <DashboardOfficeTeam />;
      case 'manage':
        return <DashboardManage />;
      case 'analytics':
        return <AnalyticsReports />;
      case 'support':
        return <DashboardSupport />;
      case 'settings':
        return <DashboardSettings />;
      case 'expenses':
        return <DashboardExpenses />;
      
      default:
        return <Home onPageChange={handlePageChange} />;
    }
  };

  const renderLayout = () => {
    const pageContent = renderPage();
    
    switch (currentLayout) {
      case 'auth':
        return <AuthLayout>{pageContent}</AuthLayout>;
      case 'dashboard':
        return <DashboardLayout currentPage={currentPage} onPageChange={handlePageChange}>{pageContent}</DashboardLayout>;
      case 'public':
      default:
        return <PublicLayout onPageChange={handlePageChange} currentPage={currentPage}>{pageContent}</PublicLayout>;
    }
  };

  return (
    <div className="app">
      <Suspense fallback={<Loader isLoading={true} />}>
        {renderLayout()}
      </Suspense>
    </div>
  );
};

export default App;
