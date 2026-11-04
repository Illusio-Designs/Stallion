'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { FiMapPin } from '../icons/hugeicons';
import DropdownSelector from './DropdownSelector';
import { getIndianCountries, getStates, getCities, reverseGeocodeLocation, verifyPartyLocation } from '../../services/apiService';
import { captureCurrentPosition, hasPartyPoint } from '../../utils/geolocation';
import '../../styles/components/shop-location.css';

// One capture flow in party creation, cart and visits. An inline confirmation
// avoids stacking dialogs inside existing drawers on narrow screens.
export default function ShopLocationCapture({ party = {}, onConfirmed, onSaved, onPendingChange, disabled = false }) {
  const id = useId();
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const partyId = party.party_id || party.id;
  const verified = party.location_source === 'verified' && hasPartyPoint(party);
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => { onPendingChange?.(busy || !!draft); }, [busy, draft, onPendingChange]);
  useEffect(() => () => { onPendingChange?.(false); }, [onPendingChange]);
  const change = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const capture = async () => {
    const token = ++request.current;
    setError(''); setBusy(true);
    try {
      const pos = await captureCurrentPosition();
      if (!Number.isFinite(pos.accuracy) || pos.accuracy <= 0 || pos.accuracy > 50) {
        throw new Error('GPS signal is too weak. Move outside or near a window and try again (accuracy must be within 50 m).');
      }
      let address;
      try { address = await reverseGeocodeLocation(pos); }
      catch { address = { found: false }; }
      if (token !== request.current) return;
      if (address.blocked) throw new Error(address.blocked.what === 'state_not_allotted'
        ? 'This location is outside your working states. Contact your office team.'
        : 'This location uses an inactive country, state or city. Contact your office team.');
      const cs = await getIndianCountries();
      const countryId = address.country_id || party.country_id || cs[0]?.id || '';
      const stateId = address.state_id || party.state_id || '';
      const cityId = address.city_id || party.city_id || '';
      const [ss, cc] = await Promise.all([countryId ? getStates(countryId) : [], stateId ? getCities(stateId) : []]);
      if (token !== request.current) return;
      setCountries(cs); setStates(ss); setCities(cc);
      setDraft({ ...pos, capturedAt: Date.now(), address: address.found ? address.address || '' : party.address || '',
        pincode: address.found ? address.pincode || '' : party.pincode || '', country_id: countryId, state_id: stateId, city_id: cityId,
        lookupMissing: !address.found });
    } catch (e) { if (token === request.current) setError(e.message || 'Could not capture your location. Please try again.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const selectRegion = async (key, value) => {
    const token = ++request.current;
    setError(''); setBusy(true);
    setDraft(prev => ({ ...prev, [key]: value, city_id: '', ...(key === 'country_id' ? { state_id: '' } : {}) }));
    setCities([]); if (key === 'country_id') setStates([]);
    try {
      const rows = value ? await (key === 'country_id' ? getStates(value) : getCities(value)) : [];
      if (token === request.current) (key === 'country_id' ? setStates : setCities)(rows);
    } catch { if (token === request.current) setError('Could not load locations. Select the country or state again to retry.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!draft.address.trim() || !/^\d{6}$/.test(draft.pincode.trim()) || !draft.country_id || !draft.state_id || !draft.city_id) {
      setError('Confirm the shipping address, country, state, city and a valid 6-digit PIN code.'); return;
    }
    if (Date.now() - draft.capturedAt > 5 * 60 * 1000) { setError('This GPS reading has expired. Tap “Try GPS again” before confirming.'); return; }
    const token = ++request.current;
    setBusy(true); setError('');
    const shipping = { address: draft.address.trim(), pincode: draft.pincode.trim(), country_id: draft.country_id, state_id: draft.state_id, city_id: draft.city_id };
    const payload = { ...shipping, latitude: draft.latitude, longitude: draft.longitude, accuracy: draft.accuracy,
      location_accuracy_m: draft.accuracy, location_source: 'verified', location_address: shipping.address,
      shipping_address_confirmed: true, confirm_address_mismatch: true };
    try {
      if (partyId) {
        const saved = await verifyPartyLocation(partyId, { ...payload, shipping_address: shipping });
        if (token !== request.current) return;
        await onSaved?.({ ...party, ...payload, ...saved });
      } else await onConfirmed?.(payload);
      if (token === request.current) setDraft(null);
    } catch (e) { if (token === request.current) setError(e.message || 'Could not save the location. Please try again.'); }
    finally { if (token === request.current) setBusy(false); }
  };
  const select = (label, key, rows, onChange) => (
    <div className="shop-capture__field">
      <span className="ui-label">{label} *</span>
      <DropdownSelector ariaLabel={label} options={[{ value: '', label: `Select ${label.toLowerCase()}` }, ...rows.map(r => ({ value: r.id, label: r.name }))]}
        value={draft[key]} onChange={onChange || (v => change(key, v))} disabled={busy || disabled}
        placeholder={`Select ${label.toLowerCase()}`} className="ui-dropdown-custom--full-width" />
    </div>
  );
  return <div className="shop-capture" aria-label="Shop location">
    <div className="shop-capture__status" role="status">
      <FiMapPin size={16} />
      <span className={`loc-pill loc-pill--${verified ? 'ok' : 'warn'}`}>
        {verified ? (partyId ? 'Shop location saved' : 'Location captured — save party to finish') : 'Location not confirmed'}
      </span>
    </div>
    {verified ? <>
      <p className="shop-capture__note">{party.address}</p>
      <a className="ui-btn ui-btn--secondary" href={`https://www.google.com/maps/search/?api=1&query=${Number(party.latitude)},${Number(party.longitude)}`} target="_blank" rel="noopener noreferrer">View on map</a>
    </> : !draft ? <>
      <button type="button" className="ui-btn ui-btn--primary shop-capture__trigger" disabled={busy || disabled} onClick={capture}>
        <FiMapPin size={16} /> {busy ? 'Getting your location…' : "I'm at the shop"}
      </button>
      <p className="shop-capture__note">Use while standing at this shop. You can review the shipping address before saving.</p>
    </> : <div className="shop-capture__confirmation">
      <strong>Confirm shipping address</strong>
      <p className="shop-capture__note">GPS accuracy: ±{Math.round(draft.accuracy)} m. Check the address and add shop or building details.</p>
      {draft.lookupMissing && <p className="shop-capture__note" role="status">Address lookup is unavailable. Enter and confirm the shipping details below; your GPS point has been captured.</p>}
      <div className="shop-capture__grid">
        <div className="shop-capture__field shop-capture__full">
          <label className="ui-label" htmlFor={`${id}-address`}>Shipping address *</label>
          <textarea id={`${id}-address`} className="ui-input" rows={3} value={draft.address} maxLength={500} disabled={busy || disabled} onChange={e => change('address', e.target.value)} />
        </div>
        {select('Country', 'country_id', countries, v => selectRegion('country_id', v))}
        {select('State', 'state_id', states, v => selectRegion('state_id', v))}
        {select('City', 'city_id', cities)}
        <div className="shop-capture__field">
          <label className="ui-label" htmlFor={`${id}-pincode`}>PIN code *</label>
          <input id={`${id}-pincode`} className="ui-input" inputMode="numeric" maxLength={6} value={draft.pincode} disabled={busy || disabled} onChange={e => change('pincode', e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      <div className="shop-capture__actions">
        <button type="button" className="ui-btn ui-btn--secondary" disabled={busy || disabled} onClick={() => { setDraft(null); setError(''); }}>Cancel</button>
        <button type="button" className="ui-btn ui-btn--secondary" disabled={busy || disabled} onClick={capture}>Try GPS again</button>
        <button type="button" className="ui-btn ui-btn--primary" disabled={busy || disabled} onClick={confirm}>{busy ? 'Saving…' : 'Confirm location'}</button>
      </div>
      {partyId && <p className="shop-capture__note">Confirming updates this party’s shipping address and saves its shop location.</p>}
    </div>}
    {error && <p className="shop-capture__error" role="alert">{error}</p>}
  </div>;
}
