/**
 * Role-based Access Control Configuration
 * Defines which pages each role can access
 */

// Define all available pages
export const ALL_PAGES = {
  DASHBOARD: 'dashboard',
  PRODUCTS: 'dashboard-products',
  ORDERS: 'orders',
  EXPENSES: 'expenses',
  TRAY: 'tray',
  EVENTS: 'events',
  PARTY: 'party',
  SALESMEN: 'salesmen',
  DISTRIBUTOR: 'distributor',
  OFFICE_TEAM: 'office-team',
  MANAGE: 'manage',
  ANALYTICS: 'analytics',
  SUPPORT: 'support',
  SETTINGS: 'settings',
};

// Role permissions mapping
export const ROLE_PERMISSIONS = {
  'product_manager': [
    ALL_PAGES.PRODUCTS,
    ALL_PAGES.SETTINGS,
  ],
  'reports_manager': [
    ALL_PAGES.ANALYTICS,
    ALL_PAGES.SETTINGS,
  ],
  'order_manager': [
    ALL_PAGES.ORDERS,
    ALL_PAGES.SETTINGS,
  ],
  'expense_manager': [
    ALL_PAGES.EXPENSES,
    ALL_PAGES.ANALYTICS,
    ALL_PAGES.SETTINGS,
  ],
  'admin': [
    // Admin has access to all pages
    ALL_PAGES.DASHBOARD,
    ALL_PAGES.PRODUCTS,
    ALL_PAGES.ORDERS,
    ALL_PAGES.EXPENSES,
    ALL_PAGES.TRAY,
    ALL_PAGES.EVENTS,
    ALL_PAGES.PARTY,
    ALL_PAGES.SALESMEN,
    ALL_PAGES.DISTRIBUTOR,
    ALL_PAGES.OFFICE_TEAM,
    ALL_PAGES.MANAGE,
    ALL_PAGES.ANALYTICS,
    ALL_PAGES.SUPPORT,
    ALL_PAGES.SETTINGS,
  ],
  'tray_manager': [
    ALL_PAGES.TRAY,
    ALL_PAGES.SETTINGS,
    ALL_PAGES.EVENTS,
  ],
  'party_manager': [
    ALL_PAGES.PARTY,
    ALL_PAGES.SETTINGS,
  ],
  'sales_manager': [
    ALL_PAGES.SALESMEN,
    ALL_PAGES.EXPENSES,
    ALL_PAGES.SETTINGS,
  ],
  'distributor_manager': [
    ALL_PAGES.DISTRIBUTOR,
    ALL_PAGES.SETTINGS,
  ],
  'distributor': [
    ALL_PAGES.DASHBOARD,
    ALL_PAGES.ORDERS,
    ALL_PAGES.PARTY,
    ALL_PAGES.SETTINGS,
  ],
  'party': [
    ALL_PAGES.DASHBOARD,
    ALL_PAGES.ORDERS,
    ALL_PAGES.SETTINGS,
  ],
  'salesman': [
    ALL_PAGES.DASHBOARD,
    ALL_PAGES.ORDERS,
    ALL_PAGES.EXPENSES,
    ALL_PAGES.ANALYTICS, // Reports
    ALL_PAGES.PARTY,
    ALL_PAGES.SETTINGS,
  ],
};

/**
 * Check if a role has access to a specific page
 * @param {string} role - User role
 * @param {string} pageId - Page ID to check
 * @returns {boolean} - True if role has access
 */
export const hasPageAccess = (role, pageId) => {
  if (!role) return false;
  
  // Normalize role to lowercase
  const normalizedRole = role.toLowerCase().trim();
  
  // Admin has access to everything
  if (normalizedRole === 'admin') {
    return true;
  }
  
  // Get permissions for the role
  const permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  
  // Check if page is in permissions list
  return permissions.includes(pageId);
};

/**
 * Get all accessible pages for a role
 * @param {string} role - User role
 * @returns {Array<string>} - Array of accessible page IDs
 */
export const getAccessiblePages = (role) => {
  if (!role) return [];
  
  const normalizedRole = role.toLowerCase().trim();
  
  // Admin has access to everything
  if (normalizedRole === 'admin') {
    return Object.values(ALL_PAGES);
  }
  
  // Return permissions for the role
  return ROLE_PERMISSIONS[normalizedRole] || [];
};

/**
 * Filter menu items based on role
 * @param {Array} menuItems - Array of menu items
 * @param {string} role - User role
 * @returns {Array} - Filtered menu items
 */
export const filterMenuItemsByRole = (menuItems, role) => {
  if (!role) return [];
  
  return menuItems.filter(item => hasPageAccess(role, item.id));
};
