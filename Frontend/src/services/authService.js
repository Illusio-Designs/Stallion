/**
 * Authentication Service
 * Handles user authentication state and token management
 */

import { clearCache } from './cacheService';
import { clearCart } from './cartService';

// Check if user is logged in
export const isLoggedIn = () => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  return !!(token && user);
};

// Get user data
export const getUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// Set user data and token
export const setAuth = (user, token) => {
  if (typeof window === 'undefined') return;
  // A cart left on this device by someone else is not the new user's cart.
  try {
    const newOwner = String((user && (user.user_id ?? user.id)) ?? '');
    const prevOwner = localStorage.getItem('stallion_cart_owner');
    if (prevOwner && newOwner && prevOwner !== newOwner) clearCart();
    if (newOwner) localStorage.setItem('stallion_cart_owner', newOwner);
  } catch { /* storage unavailable: nothing to protect */ }
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new Event('authChange'));
};

// Clear authentication data
// keepCart: used when the session simply expired, so a half-filled cart is not
// lost; it is still cleared if a different person logs in on this device.
export const logout = ({ keepCart = false } = {}) => {
  if (typeof window === 'undefined') return;
  // Tell the server to cancel this login (not needed when the session just expired)
  if (!keepCart) {
    const oldToken = localStorage.getItem('token');
    if (oldToken) {
      const envUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stallion.nishree.com';
      const base = envUrl.replace(/\/$/, '');
      const url = `${base.includes('/api') ? base : `${base}/api`}/auth/logout`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: oldToken }),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    }
  }
  // Drop all cached API data so the next user never sees the previous session's data
  clearCache();
  // The cart belongs to the person who filled it: the next user on this device
  // must not see (or order) it.
  if (!keepCart) clearCart();
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new Event('authChange'));
  // Dispatch token removal event
  window.dispatchEvent(new CustomEvent('tokenRemoved'));
};

// Get auth token
export const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

// Map common role variations (spaces / mixed case) to the canonical snake_case
// keys used by rolePermissions.js.
const ROLE_NAME_MAP = {
  'product manager': 'product_manager',
  'reports manager': 'reports_manager',
  'order manager': 'order_manager',
  'expense manager': 'expense_manager',
  'tray manager': 'tray_manager',
  'party manager': 'party_manager',
  'sales manager': 'sales_manager',
  'distributor manager': 'distributor_manager',
};

// Normalize a single role value to its canonical lowercase snake_case name.
export const normalizeRoleName = (role) => {
  if (!role) return null;
  const roleStr = String(role).toLowerCase().trim();
  return ROLE_NAME_MAP[roleStr] || roleStr;
};

// Get user role (primary/first role — kept for back-compat).
export const getUserRole = () => {
  const user = getUser();
  if (!user) return null;

  // Try different possible role field names (normalize to lowercase for consistency)
  const role = user.role || user.role_name || user.roleName || user.role_id || user.roleId || null;
  return normalizeRoleName(role);
};

// Get ALL of the user's roles (multi-role support). A member can hold several
// roles; the sidebar/nav must unlock the union of every role's pages, not just
// the primary one. Reads `user.roles` (array of names or {role_name} objects)
// and falls back to the single primary role.
export const getUserRoles = () => {
  const user = getUser();
  if (!user) return [];

  let list = [];
  if (Array.isArray(user.roles) && user.roles.length) {
    list = user.roles.map((r) =>
      typeof r === 'string' ? r : (r && (r.role_name || r.roleName || r.role || r.name))
    );
  }

  const normalized = list.map(normalizeRoleName).filter(Boolean);
  if (normalized.length) return Array.from(new Set(normalized));

  // Fallback: no roles array stored — use the single primary role.
  const single = getUserRole();
  return single ? [single] : [];
};

