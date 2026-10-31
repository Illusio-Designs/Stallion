import React, { useEffect, useMemo, useState, useRef } from 'react';
import '../styles/components/DashboardHeader.css';
import { FiBell, FiMenu, FiSidebar, FiShoppingCart } from './icons/hugeicons';
import { getCartCount, registerCartListener } from '../services/cartService';
import Tooltip from './ui/Tooltip';
import InstallAppButton from './InstallAppButton';
import ThemeSwitch from './ThemeSwitch';
import NotificationPermissionPrompt from './NotificationPermissionPrompt';
import { announceNew } from '../utils/systemNotify';
import { resolveProfileImageUrl } from '../utils/profileImage';
import { logout as authLogout, getUser, getUserRole } from '../services/authService';
import { showLogoutSuccess } from '../services/notificationService';
import { getMe } from '../services/apiService';
import { getNotifications, markNotificationsRead } from '../services/api/notificationsApi';
import GlobalSearchResults from './GlobalSearchResults';
import GooeySearch from './ui/GooeySearch';
import '../styles/redesign-n-tasks.css';

const DashboardHeader = ({ onPageChange, currentPage, isCollapsed, onMobileMenuToggle, onToggleSidebar }) => {
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Cart shortcut for tablets and computers (phones have the Cart button in the bottom bar).
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    setCartCount(getCartCount());
    return registerCartListener(() => setCartCount(getCartCount()));
  }, []);

  // Notification bell: unread count, a dropdown with the latest ones, polled every 60 s and on focus.
  const [notes, setNotes] = useState([]);
  const [unread, setUnread] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const bellRef = useRef(null);
  const bellBtnRef = useRef(null);
  const loadNotes = React.useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotes(res.data);
      setUnread(res.unread_count);
      setNotesError(false);
      announceNew(res.data);
    } catch (_e) {
      setNotesError(true); // keep what we had; the bell must never break the header
    }
  }, []);
  useEffect(() => {
    if (!getUser()) return undefined;
    loadNotes();
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') loadNotes(); }, 60000);
    const onFocus = () => loadNotes();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [loadNotes]);
  useEffect(() => {
    if (!isBellOpen) return undefined;
    const onDown = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setIsBellOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setIsBellOpen(false); if (bellBtnRef.current) bellBtnRef.current.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [isBellOpen]);
  const markAllRead = async () => {
    const before = { notes, unread };
    setNotes((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    setUnread(0);
    try { await markNotificationsRead({ all: true }); } catch (_e) { setNotes(before.notes); setUnread(before.unread); }
  };
  // A task notification opens the page where the task lives: the dashboard for a salesman, the orders page for the office.
  const openNote = async (n) => {
    setIsBellOpen(false);
    if (!n.read_at) {
      setNotes((list) => list.map((x) => (x.notification_id === n.notification_id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
      try { await markNotificationsRead({ ids: [n.notification_id] }); } catch (_e) { /* the next poll corrects the count */ }
    }
    if (onPageChange && (n.order_id || /task|tray|order/i.test(String(n.kind || '')))) {
      onPageChange(getUserRole() === 'salesman' ? 'dashboard' : 'orders');
    }
  };
  const noteTime = (v) => {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Broadcast the search query — one event for desktop and phone, so every page filters the same way.
  const [globalQuery, setGlobalQuery] = useState('');
  // Open the page a result belongs to and pass the typed text on, so its list is already filtered.
  const openResult = (page, q) => {
    if (onPageChange) onPageChange(page);
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent('globalSearchChanged', { detail: { query: q } })); } catch (_e) { /* ignore */ } }, 500);
  };
  const dispatchSearch = (q) => {
    try {
      window.dispatchEvent(new CustomEvent('globalSearchChanged', { detail: { query: q } }));
    } catch (_e) {}
  };

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
          {/* Expand / collapse the sidebar from the top bar (tablet and desktop).
              Always in reach on iPad, unlike the button at the bottom of the
              sidebar. Hidden on phones, which use the menu button above. */}
          {onToggleSidebar && (
            <Tooltip label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
              <button
                type="button"
                className="dashboard-sidebar-toggle hidden md:inline-flex bg-transparent border-none w-10 h-10 -ml-1 rounded-pill items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]"
                onClick={onToggleSidebar}
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isCollapsed}
              >
                <FiSidebar size={20} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          {/* Phones: menu button, then the logo (the sidebar carries the logo on larger screens). */}
          <button
            type="button"
            className="dashboard-header-logo md:hidden bg-transparent border-none p-0 cursor-pointer flex items-center"
            onClick={() => onPageChange?.('dashboard')}
            aria-label="Stallion Eyewear, go to the dashboard"
          >
            <img src="/images/logo/logo.webp" alt="" className="block h-9 w-auto max-w-[120px] object-contain" />
          </button>
          <div className="dashboard-title text-[length:var(--text-md)] text-text font-semibold whitespace-nowrap overflow-hidden text-ellipsis">Welcome {userName}</div>
        </div>

        <div className="dashboard-header-actions flex items-center gap-3 min-w-0">
          <div className="flex">
            <GooeySearch
              value={globalQuery}
              onChange={(q) => {
                setGlobalQuery(q);
                dispatchSearch(q);
              }}
              placeholder="Search..."
              label="Search"
              openWidth={260}
              phoneAuto
            >
              <GlobalSearchResults query={globalQuery} onPick={openResult} />
            </GooeySearch>
          </div>

          <div className="dashboard-action-icons flex items-center gap-2">
            <InstallAppButton />
            <NotificationPermissionPrompt />
            <Tooltip label="Cart" placement="bottom">
              <button
                type="button"
                className="dashboard-icon-btn hidden md:inline-flex relative bg-transparent border-none w-10 h-10 rounded-pill items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]"
                aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
                onClick={() => onPageChange?.('cart')}
              >
                <FiShoppingCart size={20} aria-hidden="true" />
                {cartCount > 0 && <span className="rdb-badge" aria-hidden="true">{cartCount > 9 ? '9+' : cartCount}</span>}
              </button>
            </Tooltip>
            <div className="rdb" ref={bellRef}>
              <Tooltip label="Notifications" placement="bottom">
                <button
                  ref={bellBtnRef}
                  type="button"
                  className="dashboard-icon-btn bg-transparent border-none w-10 h-10 rounded-pill inline-flex items-center justify-center cursor-pointer text-text-muted transition duration-200 ease-[ease] motion-reduce:transition-none hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96]"
                  aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                  aria-haspopup="true"
                  aria-expanded={isBellOpen}
                  aria-controls="rdb-panel"
                  onClick={() => { setIsBellOpen((v) => !v); if (!isBellOpen) loadNotes(); }}
                >
                  <FiBell size={20} aria-hidden="true" />
                  {unread > 0 && <span className="rdb-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
                </button>
              </Tooltip>
              {isBellOpen && (
                <div className="rdb-panel" id="rdb-panel" role="region" aria-label="Notifications">
                  <div className="rdb-panel__head">
                    <h2>Notifications</h2>
                    <button type="button" className="rdb-link" onClick={markAllRead} disabled={unread === 0}>Mark all read</button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="rdb-empty">{notesError ? 'Could not load notifications.' : 'No notifications'}</p>
                  ) : (
                    <ul className="rdb-list">
                      {[...notes].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).map((n) => (
                        <li key={n.notification_id}>
                          <button type="button" className={`rdb-item${n.read_at ? '' : ' rdb-item--unread'}`} onClick={() => openNote(n)}>
                            <span className="rdb-dot" aria-hidden="true" />
                            <span className="rdb-item__body">
                              <span>{n.title}</span>
                              {n.message && <span className="rdb-item__msg">{n.message}</span>}
                              <span className="rdb-item__time">{noteTime(n.created_at)}{n.read_at ? '' : ' · Unread'}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
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
                  <img src={resolveProfileImageUrl(avatarUrl)} alt={userName} className="dashboard-avatar-image w-full h-full object-cover rounded-pill" />
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
                  <div className="px-2 pb-2 pt-1" role="none">
                    <p className="m-0 pb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Theme</p>
                    <ThemeSwitch />
                  </div>
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
