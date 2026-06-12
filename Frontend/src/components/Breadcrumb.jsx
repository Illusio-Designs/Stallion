import React, { useState, useEffect } from 'react';
import '../styles/components/Breadcrumb.css';
import '../styles/pages/ProductDetail.css';
import { getSharedViewMode, setSharedViewMode as updateSharedViewMode, registerViewModeSetter } from '../pages/ProductDetail';

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
      const urlParams = new URLSearchParams(window.location.search);
      const modelNoParam = urlParams.get('model_no');
      const fromHomeParam = urlParams.get('fromHome');
      
      setModelNo(modelNoParam);
      setFromHome(fromHomeParam === 'true');
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
    <nav className={`breadcrumb ${showActions ? 'breadcrumb-with-actions' : ''} ${showContinueShopping ? 'breadcrumb-with-continue' : ''}`}>
      <div className="breadcrumb-container">
        <div className="breadcrumb-content">
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && (
                <span className="breadcrumb-separator">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
              <span 
                className={`breadcrumb-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => currentPage !== item.id && onPageChange(item.id)}
              >
                {item.text}
              </span>
            </React.Fragment>
          ))}
        </div>
        {showActions && (
          <div className="breadcrumb-actions">
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
          <div className="continue-shopping-action">
            <button 
              className="continue-shopping-btn"
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
