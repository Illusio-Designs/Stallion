/**
 * Dashboard routing — single source of truth.
 *
 * Dashboard pages now live under proper nested paths (e.g. /dashboard/products,
 * /dashboard/orders) instead of the old /dashboard?tab=<key> query scheme.
 *
 * The internal "page key" used by the App switch, the sidebar menu and
 * rolePermissions stays the same; only the URL slug differs. Keeping a tiny
 * key<->slug map here means the rest of the app never has to think about URLs.
 */

// All internal dashboard page keys (must match the App switch + sidebar ids).
export const DASHBOARD_PAGE_KEYS = [
  'dashboard',
  'dashboard-products',
  'orders',
  'expenses',
  'tray',
  'events',
  'party',
  'salesmen',
  'distributor',
  'office-team',
  'manage',
  'analytics',
  'support',
  'settings',
];

// page key -> URL slug under /dashboard. Only list keys whose slug differs.
const KEY_TO_SLUG = {
  'dashboard-products': 'products',
};
const SLUG_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_SLUG).map(([key, slug]) => [slug, key])
);

export const isDashboardPage = (page) => DASHBOARD_PAGE_KEYS.includes(page);

/**
 * Product detail uses a clean, readable path: /product/<model_no>
 * (the page fetches by model_no). Replaces the old
 * /product-detail?id=<uuid>&model_no=<x> query scheme.
 */
export const productPath = (modelNo) =>
  modelNo ? `/product/${encodeURIComponent(String(modelNo))}` : '/products';

/** Resolve a /product/<model_no> path to its model_no, or null if not a product path. */
export const parseProductPath = (pathname) => {
  if (!pathname) return null;
  const clean = pathname.replace(/\/+$/, '');
  if (clean.startsWith('/product/')) {
    const slug = clean.slice('/product/'.length).split('/')[0];
    return slug ? decodeURIComponent(slug) : null;
  }
  return null;
};

/**
 * Build the URL for an internal page key.
 * @param {string} page - internal page key (e.g. 'dashboard-products', 'home')
 * @param {number|string|null} [productId] - optional product id for public pages
 * @returns {string} pathname (and query when relevant)
 */
export const pageKeyToPath = (page, productId = null) => {
  if (page === 'dashboard') return '/dashboard';
  if (isDashboardPage(page)) {
    return `/dashboard/${KEY_TO_SLUG[page] || page}`;
  }
  // Non-dashboard (public / auth) pages keep their flat route.
  const base = page ? `/${page}` : '/';
  return productId ? `${base}?id=${productId}` : base;
};

/**
 * Resolve a pathname to an internal dashboard page key.
 * @param {string} pathname
 * @returns {string|null} the page key, or null if this isn't a dashboard route
 */
export const pathToDashboardPage = (pathname) => {
  if (!pathname) return null;
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/dashboard') return 'dashboard';
  if (clean.startsWith('/dashboard/')) {
    const slug = clean.slice('/dashboard/'.length).split('/')[0];
    const key = SLUG_TO_KEY[slug] || slug;
    return isDashboardPage(key) ? key : 'dashboard';
  }
  return null;
};
