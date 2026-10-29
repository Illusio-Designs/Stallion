import { describe, it, expect } from 'vitest';
import {
  accessFromRoles, parseAccess, sideOfPage, resolveSide, sideRedirect,
  retailHomeFor, wholesaleHomeFor, retailMenuFor,
} from './retailSide';
import { hasAnyRolePageAccess, hasPageAccess } from './rolePermissions';
import { RETAIL_PAGE_KEYS, DASHBOARD_PAGE_KEYS } from './dashboardRoutes';

const ADMIN = ['admin'];
const MANAGER = ['retail_manager'];
const EDITOR = ['retail_editor'];
const SALES = ['salesman'];

describe('accessFromRoles', () => {
  it('admin sees both sides', () => expect(accessFromRoles(ADMIN)).toEqual({ wholesale: true, retail: true }));
  it('retail roles see Retail only', () => {
    expect(accessFromRoles(MANAGER)).toEqual({ wholesale: false, retail: true });
    expect(accessFromRoles(EDITOR)).toEqual({ wholesale: false, retail: true });
  });
  it('any other role sees Wholesale only', () => {
    expect(accessFromRoles(SALES)).toEqual({ wholesale: true, retail: false });
    expect(accessFromRoles(['some_custom_role'])).toEqual({ wholesale: true, retail: false });
  });
  it('several roles give the union', () => expect(accessFromRoles(['salesman', 'retail_editor'])).toEqual({ wholesale: true, retail: true }));
});

describe('parseAccess', () => {
  it('reads a bare or wrapped answer', () => {
    expect(parseAccess({ wholesale: true, retail: false })).toEqual({ wholesale: true, retail: false });
    expect(parseAccess({ success: true, data: { wholesale: false, retail: true } })).toEqual({ wholesale: false, retail: true });
  });
  it('ignores anything else', () => {
    expect(parseAccess(null)).toBeNull();
    expect(parseAccess({ ok: 1 })).toBeNull();
  });
});

describe('sideOfPage', () => {
  it('knows each side', () => {
    RETAIL_PAGE_KEYS.forEach((k) => expect(sideOfPage(k)).toBe('retail'));
    DASHBOARD_PAGE_KEYS.filter((k) => k !== 'settings').forEach((k) => expect(sideOfPage(k)).toBe('wholesale'));
    ['products', 'product-detail', 'cart'].forEach((k) => expect(sideOfPage(k)).toBe('wholesale'));
    expect(sideOfPage('settings')).toBe('shared');
    expect(sideOfPage('login')).toBeNull();
  });
});

describe('resolveSide', () => {
  const both = { wholesale: true, retail: true };
  it('one side goes straight to it', () => {
    expect(resolveSide({ wholesale: false, retail: true }, 'dashboard', 'wholesale')).toBe('retail');
    expect(resolveSide({ wholesale: true, retail: false }, 'retail', 'retail')).toBe('wholesale');
  });
  it('both sides: the page decides, else the saved choice', () => {
    expect(resolveSide(both, 'retail-orders', 'wholesale')).toBe('retail');
    expect(resolveSide(both, 'orders', 'retail')).toBe('wholesale');
    expect(resolveSide(both, 'settings', 'retail')).toBe('retail');
    expect(resolveSide(both, 'settings', null)).toBe('wholesale');
  });
});

describe('role permissions keep the sides apart', () => {
  it('wholesale-only roles can never open a retail page', () => {
    ['salesman', 'party', 'distributor', 'order_manager', 'tray_manager', 'product_manager', 'sales_manager', 'unknown_role'].forEach((role) => {
      RETAIL_PAGE_KEYS.forEach((p) => expect(hasPageAccess(role, p)).toBe(false));
    });
  });
  it('retail roles can never open a wholesale page', () => {
    ['retail_manager', 'retail_editor'].forEach((role) => {
      DASHBOARD_PAGE_KEYS.filter((k) => k !== 'settings').forEach((p) => expect(hasPageAccess(role, p)).toBe(false));
    });
  });
  it('editors only get blog and SEO, managers get the whole store', () => {
    expect(retailMenuFor(EDITOR).map((i) => i.id)).toEqual(['retail-blog', 'retail-seo']);
    expect(retailMenuFor(MANAGER)).toHaveLength(9);
    expect(retailMenuFor(ADMIN)).toHaveLength(9);
    expect(retailMenuFor(SALES)).toHaveLength(0);
  });
});

describe('sideRedirect', () => {
  it('sends a wholesale-only person away from retail pages, to their own home', () => {
    expect(sideRedirect({ page: 'retail', roles: SALES, access: accessFromRoles(SALES) })).toBe('dashboard');
    expect(sideRedirect({ page: 'retail-blog', roles: ['order_manager'], access: accessFromRoles(['order_manager']) })).toBe('orders');
  });
  it('sends a retail-only person away from wholesale pages, shop and cart included', () => {
    ['dashboard', 'orders', 'party', 'products', 'cart', 'product-detail', 'manage'].forEach((p) => {
      expect(sideRedirect({ page: p, roles: MANAGER, access: accessFromRoles(MANAGER) })).toBe('retail');
      expect(sideRedirect({ page: p, roles: EDITOR, access: accessFromRoles(EDITOR) })).toBe('retail-blog');
    });
  });
  it('an editor cannot open the other retail pages', () => {
    expect(sideRedirect({ page: 'retail-orders', roles: EDITOR, access: accessFromRoles(EDITOR) })).toBe('retail-blog');
    expect(sideRedirect({ page: 'retail-blog', roles: EDITOR, access: accessFromRoles(EDITOR) })).toBeNull();
  });
  it('admin may open both, the profile page is open to everyone', () => {
    const a = accessFromRoles(ADMIN);
    expect(sideRedirect({ page: 'retail-shipping', roles: ADMIN, access: a })).toBeNull();
    expect(sideRedirect({ page: 'orders', roles: ADMIN, access: a })).toBeNull();
    expect(sideRedirect({ page: 'settings', roles: MANAGER, access: accessFromRoles(MANAGER) })).toBeNull();
    expect(sideRedirect({ page: 'settings', roles: SALES, access: accessFromRoles(SALES) })).toBeNull();
  });
  it('the server answer wins over the roles', () => {
    expect(sideRedirect({ page: 'retail', roles: MANAGER, access: { wholesale: false, retail: false } })).toBe('settings');
  });
  it('public pages are never touched', () => expect(sideRedirect({ page: 'login', roles: SALES, access: accessFromRoles(SALES) })).toBeNull());
});

describe('homes', () => {
  it('retail home by role', () => {
    expect(retailHomeFor(MANAGER)).toBe('retail');
    expect(retailHomeFor(EDITOR)).toBe('retail-blog');
  });
  it('wholesale home by role', () => {
    expect(wholesaleHomeFor(ADMIN)).toBe('dashboard');
    expect(wholesaleHomeFor(['order_manager'])).toBe('orders');
    expect(hasAnyRolePageAccess(['order_manager'], wholesaleHomeFor(['order_manager']))).toBe(true);
  });
});
