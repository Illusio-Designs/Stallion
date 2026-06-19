import React, { useEffect, useMemo, useState, useRef } from 'react';
import '../styles/components/DashboardHeader.css';
import { FiMaximize, FiMinimize, FiBell, FiMenu } from 'react-icons/fi';
import Tooltip from './ui/Tooltip';
import { logout as authLogout, getUser } from '../services/authService';
import { showLogoutSuccess } from '../services/notificationService';
import { getMe } from '../services/apiService';

const DashboardHeader = ({ onPageChange, currentPage, isCollapsed, onMobileMenuToggle }) => {
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userMenuRef = useRef(null);

  const updateUserInfo = async () => {
    try {
      // Get user from auth service
      const user = getUser();
      const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('userName') : null;
      const storedAvatar = typeof window !== 'undefined' ? window.localStorage.getItem('userAvatarUrl') : null;
      
      let name = '';
      let avatar = null;
      
      // Priority 1: Check localStorage (most up-to-date, set by DashboardSettings)
      if (storedName && storedName.trim() !== '') {
        name = storedName.trim();
      }
      
      if (storedAvatar && storedAvatar.trim() !== '') {
        avatar = storedAvatar.trim();
      }
      
      // Priority 2: Check user object from localStorage
      if (user) {
        if (!name) {
          name = user.full_name || user.fullName || user.name || user.email || '';
        }
        
        // Check for avatar in user object (profile_image, image_url, avatar, avatarUrl)
        if (!avatar) {
          avatar = user.profile_image || user.image_url || user.avatar || user.avatarUrl || null;
          if (avatar && avatar.trim() !== '') {
            avatar = avatar.trim();
          } else {
            avatar = null;
          }
        }
      }
      
      // Priority 3: Try to fetch from API if we have user ID but no name/avatar
      if (user && user.id && (!name || !avatar)) {
        try {
          // GET /users/me — current user (works for every role). Previously this
          // fetched the whole /users list (admin-only -> 403 for field roles).
          const userData = await getMe();

          if (userData) {
            if (!name) {
              name = userData.full_name || userData.name || userData.fullName || userData.email || '';
            }
            
            if (!avatar) {
              // Accept both base64 data URLs and regular URLs from API
              const apiAvatar = userData.profile_image || userData.image_url || null;
              if (apiAvatar && apiAvatar.trim() !== '') {
                avatar = apiAvatar.trim();
                // Update localStorage for future use (store whatever we got from API)
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('userAvatarUrl', avatar);
                }
                console.log('Header: Set avatar from API:', {
                  hasAvatar: !!avatar,
                  avatarLength: avatar.length,
                  isBase64: avatar.startsWith('data:'),
                  preview: avatar.substring(0, 50) + '...'
                });
              }
            }
            
            // Update localStorage with name if we got it from API
            if (name && typeof window !== 'undefined') {
              window.localStorage.setItem('userName', name);
            }
          }
        } catch (apiError) {
          // Silently fail - we'll use what we have from localStorage/user object
          console.warn('Could not fetch user data from API for header:', apiError.message);
        }
      }
      
      // Set the state with final values
      setUserName(name || 'User');
      
      if (avatar && avatar.trim() !== '') {
        setAvatarUrl(avatar);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      console.error('Error updating user info in header:', error);
      // Fallback to basic values
      const user = getUser();
      if (user) {
        setUserName(user.full_name || user.fullName || user.name || user.email || 'User');
      } else {
        const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('userName') : null;
        setUserName(storedName || 'User');
      }
      setAvatarUrl(null);
    }
  };

  useEffect(() => {
    // Initial load
    updateUserInfo();
    
    // Listen for auth changes (when user logs in/out or updates profile)
    const handleAuthChange = () => {
      updateUserInfo();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('authChange', handleAuthChange);
      return () => {
        window.removeEventListener('authChange', handleAuthChange);
      };
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('msfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('msfullscreenchange', handleFsChange);
    };
  }, []);

  // Close user dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsUserDropdownOpen(false);
      }
    };
    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserDropdownOpen]);

  const initials = useMemo(() => {
    const parts = (userName || '').trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return `${first}${second}`.toUpperCase();
  }, [userName]);

  const toggleFullscreen = () => {
    const doc = document;
    const docEl = document.documentElement;
    const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
    if (!fsEl) {
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      if (req) req.call(docEl);
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
      if (exit) exit.call(doc);
    }
  };

  return (
    <header className={`dashboard-header sticky top-0 z-[5] bg-surface border-b border-border ml-0 ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="dashboard-header-content flex items-center justify-between gap-4 px-5 py-3 min-h-[var(--header-height)] md:px-5 max-md:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="dashboard-menu-btn md:hidden bg-transparent border-none w-10 h-10 -ml-1 rounded-pill inline-flex items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]"
            onClick={onMobileMenuToggle}
            aria-label="Open menu"
          >
            <FiMenu size={22} aria-hidden="true" />
          </button>
          <div className="dashboard-title text-[length:var(--text-md)] text-text font-semibold whitespace-nowrap overflow-hidden text-ellipsis">Welcome {userName}</div>
        </div>

        <div className="dashboard-header-actions flex items-center gap-3 min-w-0">
          <a href="/products" className="dashboard-back-shop hidden md:inline-flex items-center gap-1 px-4 py-2 min-h-[40px] rounded-md bg-primary text-text-on-primary text-[length:var(--text-sm)] font-semibold no-underline whitespace-nowrap transition duration-200 ease-[ease] hover:bg-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:bg-primary-active active:scale-[0.98] motion-reduce:transition-none">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="dashboard-back-shop__label max-[480px]:hidden">Back to Shop</span>
          </a>
          <div className="dashboard-search-bar hidden md:flex items-center gap-2 bg-surface-muted border border-border rounded-pill px-3 py-2 transition duration-200 ease-[ease] motion-reduce:transition-none focus-within:border-primary focus-within:shadow-[var(--focus-ring)] focus-within:bg-surface">
            <svg className="dashboard-search-icon text-text-subtle shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="border-none outline-none bg-transparent text-text w-full text-[length:var(--text-base)] placeholder:text-text-subtle"
              onChange={(e) => {
                const q = e.target.value;
                try {
                  const ev = new CustomEvent('globalSearchChanged', { detail: { query: q } });
                  window.dispatchEvent(ev);
                } catch (_e) {}
              }}
            />
          </div>

          <div className="dashboard-action-icons flex items-center gap-2">
            <Tooltip label="Notifications" placement="bottom">
              <button className="dashboard-icon-btn bg-transparent border-none w-10 h-10 rounded-pill inline-flex items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]" aria-label="Notifications">
                <FiBell size={20} aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} placement="bottom">
              <button className="dashboard-icon-btn bg-transparent border-none w-10 h-10 rounded-pill inline-flex items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]" aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} onClick={toggleFullscreen}>
                {isFullscreen ? <FiMinimize size={20} /> : <FiMaximize size={20} />}
              </button>
            </Tooltip>
            <div className="dashboard-user-menu relative" ref={userMenuRef}>
              <button
                className="dashboard-avatar-btn has-tooltip group relative bg-primary-soft border border-border w-10 h-10 rounded-pill inline-flex items-center justify-center cursor-pointer overflow-visible transition duration-200 ease-[ease] motion-reduce:transition-none hover:border-border-strong focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                onClick={() => setIsUserDropdownOpen((v) => !v)}
                aria-label="User Menu"
                aria-haspopup="menu"
                aria-expanded={isUserDropdownOpen}
                title="User Menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="dashboard-avatar-image w-full h-full object-cover rounded-pill" />
                ) : (
                  <span className="dashboard-avatar-initials text-[length:var(--text-sm)] font-semibold text-primary leading-none">{initials || 'U'}</span>
                )}
                <span className="header-tooltip pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 translate-y-[-6px] bg-grey-900 text-text-on-primary px-2 py-1 rounded-sm text-[length:var(--text-xs)] whitespace-nowrap opacity-0 transition duration-[120ms] ease-[ease] motion-reduce:transition-none z-50 shadow-md group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0">User Menu</span>
              </button>
              {isUserDropdownOpen && (
                <div className="dashboard-user-dropdown absolute right-0 top-[calc(100%+0.5rem)] min-w-[184px] bg-surface border border-border rounded-lg shadow-lg p-1 z-[100]" role="menu">
                  <button
                    className="dropdown-item block w-full text-left px-3 py-2 min-h-[40px] border-none bg-transparent text-text text-[length:var(--text-base)] cursor-pointer rounded-md transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:bg-primary-soft"
                    role="menuitem"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      onPageChange('settings');
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    className="dropdown-item dropdown-item--danger block w-full text-left px-3 py-2 min-h-[40px] border-none bg-transparent text-error text-[length:var(--text-base)] cursor-pointer rounded-md transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-error-soft focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:bg-primary-soft"
                    role="menuitem"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      authLogout();
                      showLogoutSuccess();
                      onPageChange('');
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
