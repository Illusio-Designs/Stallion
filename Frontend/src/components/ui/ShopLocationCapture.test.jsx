import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import ShopLocationCapture from './ShopLocationCapture';
import { getIndianCountries, getStates, getCities, reverseGeocodeLocation, verifyPartyLocation } from '../../services/apiService';
import { captureCurrentPosition } from '../../utils/geolocation';
vi.mock('../../services/apiService', () => ({ getIndianCountries: vi.fn(), getStates: vi.fn(), getCities: vi.fn(), reverseGeocodeLocation: vi.fn(), verifyPartyLocation: vi.fn() }));
vi.mock('../../utils/geolocation', async original => ({ ...await original(), captureCurrentPosition: vi.fn() }));
const pos = { latitude: 21.17, longitude: 72.83, accuracy: 18 };
const address = { found: true, address: 'Shop 12, Market Road', country_id: 'in', state_id: 'gj', city_id: 'surat', pincode: '395009' };
let container, root;
const click = async text => {
  const button = [...container.querySelectorAll('button')].find(el => el.textContent.includes(text));
  expect(button, text).toBeTruthy(); await act(async () => { button.click(); });
};
const render = async props => { await act(async () => root.render(<ShopLocationCapture {...props} />)); };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  captureCurrentPosition.mockResolvedValue(pos); reverseGeocodeLocation.mockResolvedValue(address);
  getIndianCountries.mockResolvedValue([{ id: 'in', name: 'India' }]);
  getStates.mockResolvedValue([{ id: 'gj', name: 'Gujarat' }]); getCities.mockResolvedValue([{ id: 'surat', name: 'Surat' }]);
  verifyPartyLocation.mockResolvedValue({ ...pos, ...address, location_source: 'verified' });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('does not persist GPS until shipping details are confirmed', async () => {
  const saved = vi.fn(); await render({ party: { party_id: 'p1' }, onSaved: saved }); await click("I'm at the shop");
  expect(container.textContent).toContain('±18 m'); expect(verifyPartyLocation).not.toHaveBeenCalled();
  await click('Confirm location');
  expect(verifyPartyLocation).toHaveBeenCalledWith('p1', expect.objectContaining({ ...pos, shipping_address: expect.objectContaining({ address: address.address, pincode: '395009' }) }));
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ location_source: 'verified' }));
});
it('stages a new party capture and hides capture after confirmation', async () => {
  function Form() { const [party, setParty] = useState({}); return <ShopLocationCapture party={party} onConfirmed={setParty} />; }
  await act(async () => root.render(<Form />)); await click("I'm at the shop"); await click('Confirm location');
  expect(container.textContent).toContain('save party to finish'); expect(container.textContent).not.toContain("I'm at the shop");
  expect(verifyPartyLocation).not.toHaveBeenCalled();
});
it('hides capture for verified parties and restores it after removal', async () => {
  await render({ party: { ...pos, location_source: 'verified' } }); expect(container.textContent).not.toContain("I'm at the shop");
  expect(container.querySelector('a').href).toContain('21.17,72.83');
  await render({ party: { latitude: null, longitude: null, location_source: null } }); expect(container.textContent).toContain("I'm at the shop");
});
it('cancels without saving', async () => {
  await render({ party: { party_id: 'p1' } }); await click("I'm at the shop"); await click('Cancel');
  expect(verifyPartyLocation).not.toHaveBeenCalled(); expect(container.textContent).not.toContain('Confirm shipping address');
});
it('rejects weak GPS with a retry', async () => {
  captureCurrentPosition.mockResolvedValue({ ...pos, accuracy: 100 }); await render({}); await click("I'm at the shop");
  expect(container.querySelector('[role="alert"]').textContent).toContain('GPS signal is too weak'); expect(reverseGeocodeLocation).not.toHaveBeenCalled();
  captureCurrentPosition.mockResolvedValue(pos); await click("I'm at the shop"); expect(container.textContent).toContain('Confirm shipping address');
});
it('does not guess a missing PIN or save until it is supplied', async () => {
  reverseGeocodeLocation.mockResolvedValue({ ...address, pincode: '' });
  await render({ party: { party_id: 'p1', pincode: '123456' } }); await click("I'm at the shop"); await click('Confirm location');
  expect(container.querySelector('input').value).toBe(''); expect(verifyPartyLocation).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]').textContent).toContain('6-digit PIN');
});
it('allows manual confirmation when reverse lookup fails', async () => {
  reverseGeocodeLocation.mockRejectedValue(new Error('offline')); await render({ party: { ...address, party_id: 'p1' } }); await click("I'm at the shop");
  expect(container.textContent).toContain('Address lookup is unavailable'); await click('Confirm location'); expect(verifyPartyLocation).toHaveBeenCalledOnce();
});
it('does not claim success after a server conflict', async () => {
  verifyPartyLocation.mockRejectedValue(new Error('Location was already captured. Refresh this party.'));
  await render({ party: { party_id: 'p1' } }); await click("I'm at the shop"); await click('Confirm location');
  expect(container.querySelector('[role="alert"]').textContent).toContain('already captured'); expect(container.textContent).toContain('Confirm shipping address');
  expect(container.textContent).not.toContain('Shop location saved');
});
it('reports pending confirmation so the parent can prevent premature submission', async () => {
  const pending = vi.fn(); await render({ onPendingChange: pending });
  await click("I'm at the shop"); expect(pending).toHaveBeenLastCalledWith(true);
  await click('Cancel'); expect(pending).toHaveBeenLastCalledWith(false);
});
it('keeps capture available when location permission is denied', async () => {
  captureCurrentPosition.mockRejectedValue(new Error('Location permission was denied.'));
  await render({}); await click("I'm at the shop");
  expect(container.querySelector('[role="alert"]').textContent).toContain('permission was denied');
  expect(reverseGeocodeLocation).not.toHaveBeenCalled(); expect(container.textContent).toContain("I'm at the shop");
});
