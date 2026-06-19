import { describe, it, expect } from 'vitest';
import {
  pageKeyToPath,
  pathToDashboardPage,
  isDashboardPage,
  productPath,
  parseProductPath,
} from './dashboardRoutes';

describe('dashboardRoutes', () => {
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
