import { it, expect, vi } from 'vitest';
import { createParty, verifyPartyLocation } from './partnersApi';
import { apiRequest } from './client';
vi.mock('./client', () => ({ apiRequest: vi.fn().mockResolvedValue({}), fetchAllPages: vi.fn(), fetchPage: vi.fn(), sharedRead: vi.fn(), unwrapList: vi.fn() }));
it('preserves confirmed GPS when normalizing a create-party request', async () => {
  await createParty({ party_name: 'Shop', address: 'Market Road', latitude: 21.17, longitude: 72.83, accuracy: 18, shipping_address_confirmed: true, confirm_address_mismatch: true });
  expect(apiRequest).toHaveBeenLastCalledWith('/parties', expect.objectContaining({ body: expect.objectContaining({ latitude: 21.17, longitude: 72.83, accuracy: 18, shipping_address_confirmed: true }) }));
});
it('sends reviewed shipping fields with an existing-party capture', async () => {
  const shipping = { address: 'Shop 12', pincode: '395009', state_id: 'state' };
  await verifyPartyLocation('party', { latitude: 21.17, longitude: 72.83, accuracy: 18, shipping_address: shipping });
  expect(apiRequest).toHaveBeenLastCalledWith('/parties/party/verify-location', expect.objectContaining({ body: expect.objectContaining({ shipping_address: shipping, accuracy: 18 }) }));
});
