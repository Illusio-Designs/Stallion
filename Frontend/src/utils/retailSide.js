/**
 * Wholesale / Retail sides of the admin.
 *
 * Rules (the backend enforces the same ones, GET /api/retail/access is the source of truth):
 *  - admin             -> both sides
 *  - retail_manager    -> Retail only (everything in the store)
 *  - retail_editor     -> Retail only (blog and SEO)
 *  - any other role    -> Wholesale only
 * A person with several roles gets the union.
 *
 * Everything here is pure, so the route guard can be unit tested without a browser.
 */
import { RETAIL_PAGE_KEYS, isRetailPageKey, isDashboardPage } from './dashboardRoutes';
import { hasAnyRolePageAccess } from './rolePermissions';

export const RETAIL_ROLES = ['retail_manager', 'retail_editor'];
export const SIDE_STORAGE_KEY = 'stallionAdminSide';

// The shop and the cart are wholesale pages too (they show wholesale prices).
const WHOLESALE_EXTRA_PAGES = ['products', 'product-detail', 'cart'];
// Profile page: every signed-in person has one, whichever side they are on.
const SHARED_PAGES = ['settings'];

/** Retail menu, in the order people work. `short` is the label in the phone bottom bar. */
export const RETAIL_MENU = [
  { id: 'retail', text: 'Dashboard', short: 'Home' },
  { id: 'retail-orders', text: 'Online orders', short: 'Orders' },
  { id: 'retail-frames', text: 'Frames on store', short: 'Frames' },
  { id: 'retail-blog', text: 'Blog manager', short: 'Blog' },
  { id: 'retail-seo', text: 'SEO', short: 'SEO' },
  { id: 'retail-shipping', text: 'Shipping', short: 'Shipping' },
  { id: 'retail-analytics', text: 'Tracking and analytics', short: 'Tracking' },
  { id: 'retail-settings', text: 'Store settings', short: 'Store' },
  { id: 'retail-roles', text: 'Roles and access', short: 'Roles' },
];

const norm = (r) => String(r || '').toLowerCase().trim();

/** What a set of role names may open. Used until the server answers, and if it cannot. */
export const accessFromRoles = (roles) => {
  const names = (Array.isArray(roles) ? roles : []).map(norm).filter(Boolean);
  if (names.length === 0) return { wholesale: true, retail: false };
  const isAdmin = names.includes('admin');
  return {
    wholesale: isAdmin || names.some((r) => !RETAIL_ROLES.includes(r)),
    retail: isAdmin || names.some((r) => RETAIL_ROLES.includes(r)),
  };
};

/** Server answer ({ wholesale, retail } or { data: {...} }) to a clean pair of booleans, or null. */
export const parseAccess = (res) => {
  const d = res && typeof res === 'object' && res.data && typeof res.data === 'object' ? res.data : res;
  if (!d || typeof d !== 'object' || (d.wholesale === undefined && d.retail === undefined)) return null;
  return { wholesale: !!d.wholesale, retail: !!d.retail };
};

/** 'retail' | 'wholesale' | 'shared' | null (public page). */
export const sideOfPage = (page) => {
  if (isRetailPageKey(page)) return 'retail';
  if (SHARED_PAGES.includes(page)) return 'shared';
  if (isDashboardPage(page) || WHOLESALE_EXTRA_PAGES.includes(page)) return 'wholesale';
  return null;
};

/** Which side is on screen: the page decides when it belongs to one side, else the saved choice. */
export const resolveSide = (access, page, saved) => {
  const a = access || { wholesale: true, retail: false };
  if (a.wholesale && !a.retail) return 'wholesale';
  if (a.retail && !a.wholesale) return 'retail';
  if (!a.wholesale && !a.retail) return 'wholesale';
  const pageSide = sideOfPage(page);
  if (pageSide === 'retail' || pageSide === 'wholesale') return pageSide;
  return saved === 'retail' ? 'retail' : 'wholesale';
};

/** Retail menu items the roles may open. */
export const retailMenuFor = (roles) => RETAIL_MENU.filter((it) => hasAnyRolePageAccess(roles, it.id));

/** First retail page a person lands on: the manager's dashboard, the editor's blog manager. */
export const retailHomeFor = (roles) => {
  const first = retailMenuFor(roles)[0];
  return first ? first.id : 'retail';
};

// Wholesale landing page, same order the app already used.
const WHOLESALE_HOME_ORDER = ['dashboard', 'orders', 'dashboard-products', 'tray', 'events', 'party', 'salesmen', 'distributor', 'analytics', 'settings'];
export const wholesaleHomeFor = (roles) => WHOLESALE_HOME_ORDER.find((p) => hasAnyRolePageAccess(roles, p)) || 'settings';

/** Where a person lands when they pick a side (or are sent home). */
export const homeForSide = (side, roles) => (side === 'retail' ? retailHomeFor(roles) : wholesaleHomeFor(roles));

/**
 * Route guard for the side rules. Returns the page to send the person to, or null when the page is fine.
 * A retail-only person can never open a wholesale page, a wholesale-only person never a retail page,
 * and a retail page also needs a role that unlocks it (an editor cannot open Online orders).
 */
export const sideRedirect = ({ page, roles, access }) => {
  const side = sideOfPage(page);
  if (side === null || side === 'shared') return null;
  const a = access || accessFromRoles(roles);
  if (side === 'retail') {
    if (a.retail && hasAnyRolePageAccess(roles, page)) return null;
    return a.retail ? retailHomeFor(roles) : wholesaleHomeFor(roles);
  }
  // wholesale page
  if (a.wholesale) return null;
  return a.retail ? retailHomeFor(roles) : 'settings';
};

export const readSavedSide = () => {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(SIDE_STORAGE_KEY) : null;
    return v === 'retail' ? 'retail' : v === 'wholesale' ? 'wholesale' : null;
  } catch { return null; }
};

export const writeSavedSide = (side) => {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(SIDE_STORAGE_KEY, side === 'retail' ? 'retail' : 'wholesale'); } catch { /* storage blocked: the switch still works for this visit */ }
};

export { RETAIL_PAGE_KEYS };
