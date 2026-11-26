import { beforeEach, it, expect, vi } from 'vitest';
import { getProducts } from './productApi';
import { apiRequest } from './client';
vi.mock('../cacheService', () => ({ getCached: (_key, load) => load(), invalidateCache: vi.fn() }));
vi.mock('./client', () => ({ TTL_PRODUCTS: 0, apiRequest: vi.fn(), getAuthToken: vi.fn(), getBaseURL: vi.fn(), handleResponse: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); apiRequest.mockResolvedValue({ data: [], pagination: { total: 0 } }); });
it('sends a selected collection with the other shop filters', async () => {
  await getProducts(1, 20, { collection_id: 'collection-a', brand_id: 'brand-a', in_stock: true, status: 'active' });
  expect(apiRequest).toHaveBeenCalledWith('/products/?page=1&limit=20', expect.objectContaining({ body: { collection_id: 'collection-a', brand_id: 'brand-a', in_stock: true, status: 'active' } }));
});
it('preserves multiple selected collections for server-side filtering', async () => {
  await getProducts(1, 20, { collection_id: ['collection-a', 'collection-b'] });
  expect(apiRequest.mock.calls[0][1].body.collection_id).toEqual(['collection-a', 'collection-b']);
});
it('omits collection filtering after selections are cleared', async () => {
  await getProducts(1, 20, { in_stock: true });
  expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('collection_id');
});
