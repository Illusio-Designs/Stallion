import React, { useState, useEffect, useRef } from 'react';
import '../styles/components/Header.css';
import { getCartCount, registerCartListener } from '../services/cartService';
import { isLoggedIn, logout as authLogout } from '../services/authService';
import { showLogoutSuccess } from '../services/notificationService';
import { FiSearch, FiShoppingCart, FiUser, FiMenu, FiX } from 'react-icons/fi';

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
    <header className={`header fixed top-0 left-0 right-0 z-[1000] h-[var(--header-height)] text-text-on-primary transition-[background,box-shadow] duration-300 ease-[ease] ${isScrolled ? 'scrolled bg-primary shadow-md' : 'bg-transparent'}`}>
      <div className="header-content relative mx-auto flex h-full items-center justify-between px-[4%] sm:px-[5%]">
        {/* mobile backdrop */}
        <div className={`mobile-backdrop fixed inset-0 z-[1002] transition-[background,backdrop-filter] duration-300 ease-[ease] motion-reduce:transition-none ${isMenuOpen ? 'open pointer-events-auto' : 'pointer-events-none'}`} onClick={() => setIsMenuOpen(false)} aria-hidden="true" />

        <nav
          ref={drawerRef}
          className={`nav-menu items-center gap-8 ${isMenuOpen ? 'mobile open' : 'hidden md:flex'}`}
          aria-label="Primary"
          {...(isMenuOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Navigation menu' } : {})}
        >
          {/* mobile drawer header (logo + close) */}
          {isMenuOpen && (
            <div className="mobile-drawer-header mb-2 flex items-center justify-between gap-3 border-b border-white/12 pb-4">
              <div className="mobile-logo cursor-pointer rounded-sm" onClick={() => { setIsMenuOpen(false); if (onPageChange) onPageChange(''); else window.location.href = '/'; }}>
                <img src="/images/logo/logo.webp" alt="Stallion" className="logo-image" />
              </div>
              <button type="button" className="icon-btn drawer-close-btn text-text-on-primary" onClick={() => setIsMenuOpen(false)} aria-label="Close menu">
                <FiX size={20} aria-hidden="true" />
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
        
        <div className="logo flex cursor-pointer items-center rounded-sm focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.5)]" onClick={() => onPageChange ? onPageChange('') : window.location.href = '/'}>
          <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="logo-image block h-11 w-[124px] object-contain" />
        </div>

        <div className="header-actions flex items-center gap-2 md:gap-5">
          <div className="search-bar relative hidden items-center rounded-pill border border-white/22 bg-white/[0.06] px-4 py-2 transition-[background,border-color,box-shadow] duration-200 ease-[ease] hover:bg-white/10 focus-within:border-white/70 focus-within:bg-white/12 focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.16)] sm:flex sm:min-w-[150px] md:min-w-[220px]">
            <form onSubmit={handleSearchSubmit} role="search" className="flex w-full items-center">
              <FiSearch size={18} className="search-icon mr-2 shrink-0 text-white/85" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search products..."
                aria-label="Search products"
                value={searchQuery}
                onChange={handleSearchChange}
                className="min-w-0 flex-1 border-none bg-none p-0 text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-on-primary outline-none placeholder:text-white/65"
              />
            </form>
          </div>
          <div className="action-icons flex items-center gap-2">
            <button type="button" className="icon-btn cart-btn relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-none bg-none p-2 text-text-on-primary transition-[background,transform] duration-200 ease-[ease] hover:bg-white/12 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.5)] active:scale-[0.94]" onClick={() => onPageChange('cart')} aria-label={cartCount > 0 ? `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Cart'}>
              <FiShoppingCart size={28} aria-hidden="true" />
              {cartCount > 0 && (
                <span className="cart-badge absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill border-2 border-primary bg-accent px-[5px] text-[length:var(--text-xs)] font-bold leading-none text-text-on-accent" aria-hidden="true">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </button>
            <div className="user-menu-container relative" ref={dropdownRef}>
              <button
                type="button"
                className="icon-btn user-btn relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-none bg-none p-2 text-text-on-primary transition-[background,transform] duration-200 ease-[ease] hover:bg-white/12 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.5)] active:scale-[0.94]"
                onClick={handleUserIconClick}
                aria-label={loggedIn ? 'User menu' : 'Login'}
                aria-haspopup={loggedIn ? 'menu' : undefined}
                aria-expanded={loggedIn ? isUserDropdownOpen : undefined}
              >
                <FiUser size={28} aria-hidden="true" />
              </button>
              {loggedIn && isUserDropdownOpen && (
                <div className="user-dropdown absolute right-0 top-[calc(100%+0.5rem)] z-[1001] min-w-[184px] max-[768px]:min-w-[168px] overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-lg" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border-none bg-none px-3 py-2 text-left text-[length:var(--text-base)] font-medium text-text transition-[background-color,color] duration-200 ease-[ease] hover:bg-primary-soft focus-visible:outline-none focus-visible:bg-primary-soft focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)] active:bg-primary-soft-hover"
                    onClick={handleDashboardClick}
                  >
                    My Dashboard
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="dropdown-item flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border-none bg-none px-3 py-2 text-left text-[length:var(--text-base)] font-medium text-text transition-[background-color,color] duration-200 ease-[ease] hover:bg-primary-soft focus-visible:outline-none focus-visible:bg-primary-soft focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)] active:bg-primary-soft-hover"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
            {!isMenuOpen && (
              <button type="button" ref={menuBtnRef} className="icon-btn menu-btn z-[1004] inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border-none bg-none p-2 text-text-on-primary transition-[background,transform] duration-200 ease-[ease] hover:bg-white/12 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.5)] active:scale-[0.94] md:hidden" aria-label="Open menu" aria-expanded={isMenuOpen} aria-haspopup="dialog" onClick={() => setIsMenuOpen(true)}>
                <FiMenu size={28} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;