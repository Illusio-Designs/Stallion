import React, { useState, useEffect, useRef } from 'react';
import '../styles/components/Header.css';
import { getCartCount, registerCartListener } from '../services/cartService';
import { isLoggedIn, logout as authLogout } from '../services/authService';
import { showLogoutSuccess } from '../services/notificationService';

const Header = ({ onPageChange, currentPage }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const drawerRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    // Initialize on mount and then listen for scroll
    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Initialize cart count
    setCartCount(getCartCount());
    
    // Listen for cart changes
    const unsubscribe = registerCartListener(() => {
      setCartCount(getCartCount());
    });
    
    return unsubscribe;
  }, []);

  // Check login status on mount and when page changes
  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [currentPage]);

  // Listen for storage changes to update login status
  useEffect(() => {
    const handleStorageChange = () => {
      setLoggedIn(isLoggedIn());
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('authChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleStorageChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    };

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen]);

  // Mobile drawer: lock body scroll, trap focus, close on Escape, restore focus on close
  useEffect(() => {
    if (!isMenuOpen) return;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const drawer = drawerRef.current;
    const getFocusable = () =>
      drawer
        ? Array.from(
            drawer.querySelectorAll(
              'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Move focus into the drawer
    const focusables = getFocusable();
    if (focusables.length) focusables[0].focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      // Restore focus to the trigger (or whatever was focused before)
      const restoreTarget = menuBtnRef.current || previouslyFocused;
      if (restoreTarget && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus();
      }
    };
  }, [isMenuOpen]);

  // Close user dropdown on Escape
  useEffect(() => {
    if (!isUserDropdownOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsUserDropdownOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isUserDropdownOpen]);

  // Handle user icon click
  const handleUserIconClick = () => {
    if (loggedIn) {
      setIsUserDropdownOpen(!isUserDropdownOpen);
    } else {
      onPageChange('login');
    }
  };

  // Handle dashboard navigation
  const handleDashboardClick = () => {
    setIsUserDropdownOpen(false);
    onPageChange('dashboard');
  };

  // Handle logout
  const handleLogout = () => {
    setIsUserDropdownOpen(false);
    authLogout();
    setLoggedIn(false);
    showLogoutSuccess();
    onPageChange('');
  };

  // Handle search form submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Form submit is handled by real-time search, no need to do anything here
  };

  // Handle real-time search with debounce
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce the search to avoid too many updates
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      // If not on products page, navigate there first
      if (currentPage !== 'products') {
        if (onPageChange) {
          onPageChange('products');
        } else {
          window.location.href = `/products${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`;
          return;
        }
      }
      
      // Update URL with search parameter
      const url = new URL(window.location);
      url.pathname = '/products';
      if (query.trim()) {
        url.searchParams.set('search', query.trim());
      } else {
        url.searchParams.delete('search');
      }
      window.history.pushState({}, '', url);
      
      // Trigger a custom event to notify Products page of search change
      window.dispatchEvent(new CustomEvent('searchChange', { detail: { search: query } }));
    }, 300); // 300ms debounce
  };

  const navItems = [
    { id: '', text: 'Home' },
    { id: 'products', text: 'Shop' },
    { id: 'about', text: 'About' }
  ];

  return (
    <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-content">
        {/* mobile backdrop */}
        <div className={`mobile-backdrop ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)} aria-hidden="true" />

        <nav
          ref={drawerRef}
          className={`nav-menu ${isMenuOpen ? 'mobile open' : ''}`}
          aria-label="Primary"
          {...(isMenuOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation menu' } : {})}
        >
          {/* mobile drawer header (logo + close) */}
          {isMenuOpen && (
            <div className="mobile-drawer-header">
              <div className="mobile-logo" onClick={() => { setIsMenuOpen(false); if (onPageChange) onPageChange(''); else window.location.href = '/'; }}>
                <img src="/images/logo/logo.webp" alt="Stallion" className="logo-image" />
              </div>
              <button type="button" className="icon-btn drawer-close-btn" onClick={() => setIsMenuOpen(false)} aria-label="Close menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.id === '' ? '/' : `/${item.id}`}
              className={currentPage === item.id ? 'active' : ''}
              aria-current={currentPage === item.id ? 'page' : undefined}
              onClick={e => {
                e.preventDefault();
                if (onPageChange) onPageChange(item.id);
                else window.location.href = item.id === '' ? '/' : `/${item.id}`;
                // close mobile menu after navigation
                setIsMenuOpen(false);
              }}
            >
              {item.text}
            </a>
          ))}
        </nav>
        
        <div className="logo" onClick={() => onPageChange ? onPageChange('') : window.location.href = '/'}>
          <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="logo-image" />
        </div>
        
        <div className="header-actions">
          <div className="search-bar">
            <form onSubmit={handleSearchSubmit} role="search">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                aria-label="Search products"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </form>
          </div>
          <div className="action-icons">
            <button type="button" className="icon-btn cart-btn" onClick={() => onPageChange('cart')} aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}>
              <img src="/images/icons/shopping-bag-02.webp" alt="" aria-hidden="true" className="icon-image" />
              {cartCount > 0 && (
                <span className="cart-badge" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </button>
            <div className="user-menu-container" ref={dropdownRef}>
              <button
                type="button"
                className="icon-btn user-btn"
                onClick={handleUserIconClick}
                aria-label={loggedIn ? 'User menu' : 'Login'}
                aria-haspopup={loggedIn ? 'menu' : undefined}
                aria-expanded={loggedIn ? isUserDropdownOpen : undefined}
              >
                <img src="/images/icons/user-circle.webp" alt="" aria-hidden="true" className="icon-image" />
              </button>
              {loggedIn && isUserDropdownOpen && (
                <div className="user-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item"
                    onClick={handleDashboardClick}
                  >
                    My Dashboard
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
            {!isMenuOpen && (
              <button type="button" ref={menuBtnRef} className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={isMenuOpen} aria-haspopup="dialog" onClick={() => setIsMenuOpen(true)}>
                <img src="/images/icons/menu.webp" alt="" aria-hidden="true" className="icon-image" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;