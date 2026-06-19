import React, { useState, useEffect } from 'react';
import '../styles/components/Breadcrumb.css';
import '../styles/pages/ProductDetail.css';
import { getSharedViewMode, setSharedViewMode as updateSharedViewMode, registerViewModeSetter } from '../pages/ProductDetail';
import { parseProductPath } from '../utils/dashboardRoutes';

const Breadcrumb = ({ currentPage, onPageChange }) => {
  const [viewMode, setViewMode] = useState(getSharedViewMode());
  const [modelNo, setModelNo] = useState(null);
  const [fromHome, setFromHome] = useState(false);
  
  useEffect(() => {
    registerViewModeSetter((mode) => {
      setViewMode(mode);
    });
    // Sync initial state
    setViewMode(getSharedViewMode());
  }, [currentPage]);

  // Get model_no from URL and check if coming from home
  useEffect(() => {
    if (currentPage === 'product-detail' && typeof window !== 'undefined') {
      // Clean route /product/<model_no>, with legacy ?model_no= fallback.
      const fromPath = parseProductPath(window.location.pathname);
      const urlParams = new URLSearchParams(window.location.search);
      setModelNo(fromPath || urlParams.get('model_no'));
      setFromHome(false); // Always Home > Shop > Product
    } else {
      setModelNo(null);
      setFromHome(false);
    }
  }, [currentPage]);
  
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    updateSharedViewMode(mode);
  };
  
  // Define breadcrumb paths for each page
  const getBreadcrumbPath = (page) => {
    const breadcrumbMap = {
      'collection': [
        { id: 'home', text: 'Home' },
        { id: 'collection', text: 'Collection' }
      ],
      'products': [
        { id: 'home', text: 'Home' },
        { id: 'products', text: 'Shop' }
      ],
      'about': [
        { id: 'home', text: 'Home' },
        { id: 'about', text: 'About' }
      ],
      'privacy-policy': [
        { id: 'home', text: 'Home' },
        { id: 'privacy-policy', text: 'Privacy Policy' }
      ],
      'contact': [
        { id: 'home', text: 'Home' },
        { id: 'contact', text: 'Contact' }
      ],
      'cart': [
        { id: 'home', text: 'Home' },
        { id: 'products', text: 'Shop' },
        { id: 'cart', text: 'Cart', isLast: true }
      ],
      'product-detail': (() => {
        // If coming from home page, show: Home > Model No
        if (fromHome) {
          return [
            { id: 'home', text: 'Home' },
            { id: 'product-detail', text: modelNo || 'Product Detail', isLast: true }
          ];
        }
        // If coming from products page, show: Home > Shop > Model No
        return [
          { id: 'home', text: 'Home' },
          { id: 'products', text: 'Shop' },
          { id: 'product-detail', text: modelNo || 'Product Detail', isLast: true }
        ];
      })()
    };

    return breadcrumbMap[page] || [];
  };

  const breadcrumbItems = getBreadcrumbPath(currentPage);

  // Don't render breadcrumbs for home page
  if (currentPage === 'home' || breadcrumbItems.length === 0) {
    return null;
  }

  const showActions = currentPage === 'product-detail';
  const showContinueShopping = currentPage === 'cart';

  const handleContinueShopping = () => {
    if (onPageChange) {
      onPageChange('products');
    } else {
      window.location.href = '/products';
    }
  };

  return (
    <nav
      className={`breadcrumb ${showActions ? 'breadcrumb-with-actions' : ''} ${showContinueShopping ? 'breadcrumb-with-continue' : ''} relative z-[999] bg-primary px-[5%] pb-4 pt-[calc(var(--header-height)+0.5rem)] sm:pt-[calc(var(--header-height)+1rem)]`}
      aria-label="Breadcrumb"
    >
      <div className="breadcrumb-container flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <ol className="breadcrumb-content m-0 flex min-w-0 list-none flex-wrap items-center gap-0.5 p-0 sm:gap-1 leading-[var(--leading-snug)] text-white/70 text-[length:var(--text-sm)] md:text-[length:var(--text-base)] lg:text-[length:var(--text-md)]">
          {breadcrumbItems.map((item, index) => {
            const isCurrent = item.isLast || index === breadcrumbItems.length - 1 || currentPage === item.id;
            return (
              <li className="breadcrumb-crumb inline-flex min-w-0 items-center" key={item.id}>
                {index > 0 && (
                  <span className="breadcrumb-separator inline-flex shrink-0 items-center text-white/45" aria-hidden="true">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                {isCurrent ? (
                  <span className="breadcrumb-item active m-0 inline-block max-w-none cursor-default whitespace-normal rounded-sm px-2 py-1 font-semibold text-white/60" aria-current="page" title={item.text}>
                    {item.text}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="breadcrumb-item m-0 inline-block max-w-[110px] cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border-none bg-transparent px-1 py-1 text-white/90 transition-colors duration-200 ease-[ease] hover:bg-white/10 hover:text-white active:bg-white/[0.16] focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.65)] focus-visible:outline-none motion-reduce:transition-none sm:max-w-[150px] md:max-w-[220px] md:px-2"
                    onClick={() => onPageChange(item.id)}
                  >
                    {item.text}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        {showActions && (
          <div className="breadcrumb-actions flex w-full shrink-0 items-center gap-3 sm:w-auto">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('grid')}
              >
                Grid
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => handleViewModeChange('list')}
              >
                List
              </button>
            </div>
          </div>
        )}
        {showContinueShopping && (
          <div className="continue-shopping-action flex w-full shrink-0 items-center sm:w-auto">
            <button
              className="continue-shopping-btn inline-flex min-h-10 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-md border-none bg-surface px-6 py-2 font-semibold text-primary text-[length:var(--text-base)] transition duration-200 ease-[ease] hover:bg-accent hover:text-[var(--color-text-on-accent)] active:scale-[0.98] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.65)] focus-visible:outline-none motion-reduce:transition-none sm:w-auto"
              onClick={handleContinueShopping}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Breadcrumb;
