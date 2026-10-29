import { describe, it, expect } from 'vitest';
import {
  pageKeyToPath,
  pathToDashboardPage,
  isDashboardPage,
  productPath,
  parseProductPath,
  RETAIL_PAGE_KEYS,
} from './dashboardRoutes';

describe('dashboardRoutes', () => {
  it('maps retail pages to /dashboard/retail/... and back', () => {
    expect(pageKeyToPath('retail')).toBe('/dashboard/retail');
    expect(pageKeyToPath('retail-orders')).toBe('/dashboard/retail/orders');
    expect(pageKeyToPath('retail-analytics')).toBe('/dashboard/retail/analytics');
    expect(pathToDashboardPage('/dashboard/retail')).toBe('retail');
    expect(pathToDashboardPage('/dashboard/retail/')).toBe('retail');
    expect(pathToDashboardPage('/dashboard/retail/orders')).toBe('retail-orders');
    expect(pathToDashboardPage('/dashboard/retail/unknown')).toBe('retail');
    for (const key of RETAIL_PAGE_KEYS) {
      expect(isDashboardPage(key)).toBe(true);
      expect(pathToDashboardPage(pageKeyToPath(key))).toBe(key);
    }
  });

  it('maps dashboard page keys to nested paths', () => {
    expect(pageKeyToPath('dashboard')).toBe('/dashboard');
    expect(pageKeyToPath('dashboard-products')).toBe('/dashboard/products');
    expect(pageKeyToPath('orders')).toBe('/dashboard/orders');
    expect(pageKeyToPath('settings')).toBe('/dashboard/settings');
  });

  it('maps non-dashboard pages to flat paths', () => {
    expect(pageKeyToPath('about')).toBe('/about');
    expect(pageKeyToPath('products', 123)).toBe('/products?id=123');
    expect(pageKeyToPath('')).toBe('/');
  });

  it('resolves nested dashboard paths to page keys', () => {
    expect(pathToDashboardPage('/dashboard')).toBe('dashboard');
    expect(pathToDashboardPage('/dashboard/products')).toBe('dashboard-products');
    expect(pathToDashboardPage('/dashboard/orders/')).toBe('orders');
    expect(pathToDashboardPage('/products')).toBeNull();
    expect(pathToDashboardPage('/')).toBeNull();
  });

  it('round-trips key <-> path for every dashboard page', () => {
    for (const key of ['dashboard', 'dashboard-products', 'orders', 'settings', 'analytics']) {
      expect(pathToDashboardPage(pageKeyToPath(key))).toBe(key);
    }
  });

  it('isDashboardPage', () => {
    expect(isDashboardPage('orders')).toBe(true);
    expect(isDashboardPage('about')).toBe(false);
  });

  it('product path helpers (encode/decode + fallback)', () => {
    expect(productPath('MAS-MYSTIC-C2')).toBe('/product/MAS-MYSTIC-C2');
    expect(productPath('A B')).toBe('/product/A%20B');
    expect(productPath()).toBe('/products');
    expect(parseProductPath('/product/MAS-MYSTIC-C2')).toBe('MAS-MYSTIC-C2');
    expect(parseProductPath('/product/A%20B')).toBe('A B');
    expect(parseProductPath('/products')).toBeNull();
  });
});
