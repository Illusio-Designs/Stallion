import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardTray from '../pages/DashboardTray';
import { getTraysPage, searchTrayProducts } from '../services/apiService';

vi.mock('../services/apiService', () => ({
  getTraysPage: vi.fn(async () => ({ data: [], pagination: { totalPages: 1 } })),
  searchTrayProducts: vi.fn(),
}));
vi.mock('../services/authService', () => ({ getUserRoles: () => [] }));
vi.mock('../components/ui/ConfirmProvider', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../components/ui/GooeySearch', () => ({
  default: ({ value, onChange, label }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}));
vi.mock('../services/notificationService', () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(async () => { if (root) await act(() => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); vi.clearAllMocks(); });

it('searches the catalog and displays assignment details, then restores trays on clear', async () => {
  vi.useFakeTimers();
  searchTrayProducts.mockResolvedValue({ data: [
    { product_id: '1', model_no: 'Alpha', assignments: [{ tray_id: 't', tray_name: 'Tray 12', holder_name: 'Ravi' }] },
    { product_id: '2', model_no: 'Alpha 2', assignments: [] },
  ], pagination: { totalPages: 1 } });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(() => root.render(<DashboardTray />));
  const input = host.querySelector('input[aria-label="Search products by name or model"]');
  const type = async value => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await type('Alpha');
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  expect(searchTrayProducts).toHaveBeenCalledWith(1, 'Alpha');
  expect(host.textContent).toContain('Assigned');
  expect(host.textContent).toContain('Tray 12');
  expect(host.textContent).toContain('With Ravi');
  expect(host.textContent).toContain('Not assigned');
  expect(getTraysPage).toHaveBeenCalledTimes(1);
  await type('');
  expect(host.querySelector('[aria-label="Product search results"]')).toBeNull();
});
