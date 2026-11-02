'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import AsidePanel from '../ui/AsidePanel';
import DropdownSelector from '../ui/DropdownSelector';
import AddressAutocomplete from '../ui/AddressAutocomplete';
import { useConfirm } from '../ui/ConfirmProvider';
import { FormProgress } from '../forms/FormBits';
import {
  createParty,
  getCities,
  getIndianCountries,
  getStates,
  getZones,
  removePartyLocation,
  updateParty,
} from '../../services/apiService';
import { getUserRole, getUserRoles } from '../../services/authService';
import { showError, showSuccess, showWarning } from '../../services/notificationService';
import {
  buildPartyPayload,
  emptyPartyForm,
  foreignKeyFields,
  formFromParty,
  friendlySaveError,
  isAuthExpiredError,
  isForeignKeyError,
  isInitializationError,
  partyIdOf,
  progressDone,
  validatePartyForm,
} from './partyForm';
import '../../styles/redesign-n-party.css';
import '../../styles/redesign-n-headings.css';
import '../../styles/redesign-p-party.css';
import '../../styles/redesign-p-forms.css';

/**
 * The one Add party / Edit party panel, used by the Parties page and the Cart.
 *
 * Props
 *  - open: show the panel.
 *  - onClose(): the panel was closed (cancelled, or closed after a save).
 *  - party: the party row to edit, or null to add a new one.
 *  - mode: 'add' | 'edit'. Optional; taken from `party` when left out.
 *  - defaults: starting values for a new party, e.g. { party_name: 'Acme' }.
 *  - defaultToIndia: pick India as the country of a new party (the Cart does).
 *  - onSaved(saved, meta): called after a successful save, before onClose.
 *      meta.mode      'add' | 'edit'
 *      meta.payload   what was sent to the server (add and edit)
 *      meta.refetch   true when the result is unknown or unusable (the server answered
 *                     with an internal error, or a retry created the party): reload the list.
 *  - onLocationRemoved(partyId, cleared): the saved shop location of the party was removed.
 */
export default function PartyFormPanel({
  open,
  onClose,
  party = null,
  mode,
  defaults = null,
  defaultToIndia = false,
  onSaved,
  onLocationRemoved,
}) {
  const confirm = useConfirm();
  const userRole = useMemo(() => getUserRole(), []);
  const roleList = useMemo(() => getUserRoles(), []);
  const isSalesman = userRole === 'salesman';
  const isDistributor = userRole === 'distributor';
  const isAdmin = userRole === 'admin';
  const isPartyManager = useMemo(
    () => roleList.some((r) => ['admin', 'party_manager', 'sales_manager'].includes(r)),
    [roleList],
  );

  const [formData, setFormData] = useState(emptyPartyForm);
  // The party being edited (null while adding). It follows the form after a save that
  // left the party without a location, so the address can be picked right away.
  const [editRow, setEditRow] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingLoc, setSavingLoc] = useState(false);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);

  const countriesLoaded = useRef(false);
  const prevCountryIdRef = useRef('');
  const prevStateIdRef = useRef('');
  const prevCityIdRef = useRef('');
  const isInitializingEditRef = useRef(false);
  const initToken = useRef(0);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchCountries = useCallback(async () => {
    if (countriesLoaded.current) return [];
    try {
      const data = await getIndianCountries();
      countriesLoaded.current = true;
      setCountries(data || []);
      return data || [];
    } catch (error) {
      console.error('Failed to load countries:', error);
      return [];
    }
  }, []);

  const fetchStates = async (countryId) => {
    if (!countryId) { setStates([]); return; }
    try { setStates((await getStates(countryId)) || []); } catch (error) {
      console.error('Failed to load states:', error);
      setStates([]);
    }
  };
  const fetchCities = async (stateId) => {
    if (!stateId) { setCities([]); return; }
    try { setCities((await getCities(stateId)) || []); } catch (error) {
      console.error('Failed to load cities:', error);
      setCities([]);
    }
  };
  const fetchZones = async (cityId) => {
    if (!cityId) { setZones([]); return; }
    try { setZones((await getZones(cityId)) || []); } catch (error) {
      console.error('Failed to load zones:', error);
      setZones([]);
    }
  };

  // Country -> state -> city -> zone cascade. A dependent field is cleared only when the
  // person changed its parent, not while a party is being loaded into the form.
  useEffect(() => {
    if (formData.country_id) {
      fetchStates(formData.country_id);
      if (!isInitializingEditRef.current && prevCountryIdRef.current !== '' && prevCountryIdRef.current !== formData.country_id) {
        setFormData((prev) => ({ ...prev, state_id: '', city_id: '', zone_id: '' }));
        setCities([]);
        setZones([]);
      }
      prevCountryIdRef.current = formData.country_id;
    } else {
      setStates([]);
      if (!isInitializingEditRef.current) { setCities([]); setZones([]); }
      prevCountryIdRef.current = '';
    }
  }, [formData.country_id]);

  useEffect(() => {
    if (formData.state_id) {
      fetchCities(formData.state_id);
      if (!isInitializingEditRef.current && prevStateIdRef.current !== '' && prevStateIdRef.current !== formData.state_id) {
        setFormData((prev) => ({ ...prev, city_id: '', zone_id: '' }));
        setZones([]);
      }
      prevStateIdRef.current = formData.state_id;
    } else {
      if (!isInitializingEditRef.current) { setCities([]); setZones([]); }
      prevStateIdRef.current = '';
    }
  }, [formData.state_id]);

  useEffect(() => {
    if (formData.city_id) {
      fetchZones(formData.city_id);
      if (!isInitializingEditRef.current && prevCityIdRef.current !== '' && prevCityIdRef.current !== formData.city_id) {
        setFormData((prev) => ({ ...prev, zone_id: '' }));
      }
      prevCityIdRef.current = formData.city_id;
    } else {
      if (!isInitializingEditRef.current) setZones([]);
      prevCityIdRef.current = '';
    }
  }, [formData.city_id]);

  // Put a party (or a blank form) into the panel. Lists load first so the selected values show names.
  const loadInto = useCallback(async (row) => {
    const token = ++initToken.current;
    isInitializingEditRef.current = true;
    try {
      const list = await fetchCountries();
      if (token !== initToken.current || !mounted.current) return;
      if (row) {
        if (row.country_id) {
          await fetchStates(row.country_id);
          if (row.state_id) {
            await fetchCities(row.state_id);
            if (row.city_id) await fetchZones(row.city_id);
          }
        }
        if (token !== initToken.current || !mounted.current) return;
        prevCountryIdRef.current = row.country_id || '';
        prevStateIdRef.current = row.state_id || '';
        prevCityIdRef.current = row.city_id || '';
        setFormData(formFromParty(row));
        setEditRow({ ...row, id: partyIdOf(row) });
      } else {
        const base = { ...emptyPartyForm(), ...(defaultsRef.current || {}) };
        if (defaultToIndia && !base.country_id) {
          const all = list.length ? list : countries;
          const india = all.find((c) => c.name?.toLowerCase() === 'india' || c.code?.toLowerCase() === 'in');
          if (india) base.country_id = india.id;
        }
        setFormData(base);
        setEditRow(null);
      }
      setReady(true);
    } finally {
      setTimeout(() => { isInitializingEditRef.current = false; }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCountries, defaultToIndia]);

  // Opening (or switching party): load it into the form. The panel stays hidden until it is ready.
  useEffect(() => {
    if (!open) { initToken.current += 1; setReady(false); return; }
    setReady(false);
    loadInto(mode === 'add' ? null : (party || null));
  }, [open, party, mode, loadInto]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // A Google address was picked: fill the address, pincode, country, state and city. Anything
  // the lists did not have was added by the server, so the dropdowns are reloaded first.
  const handleAddressPick = async (d) => {
    if (d.blocked && d.blocked.what === 'state_not_allotted') {
      showWarning(`${d.blocked.name || 'This state'} is not one of the states you work in, so a party cannot be added there. Ask an admin to add it to your working states.`);
      return;
    }
    if (d.blocked) {
      const names = d.names || {};
      showWarning(`${names[d.blocked.what] || d.blocked.name} is switched off in Manage. The address is filled in; ask an admin to switch it on, then pick the ${d.blocked.what} yourself.`);
      setFormData((prev) => ({ ...prev, address: d.address || d.address_line || d.suggestion_main, pincode: d.pincode || prev.pincode, address_lat: d.latitude ?? null, address_lng: d.longitude ?? null }));
      return;
    }
    isInitializingEditRef.current = true;
    try {
      if (d.country_id) {
        try { setCountries((await getIndianCountries()) || []); } catch { /* the old list stays */ }
        await fetchStates(d.country_id);
        if (d.state_id) await fetchCities(d.state_id);
        if (d.city_id) await fetchZones(d.city_id);
        prevCountryIdRef.current = d.country_id;
        prevStateIdRef.current = d.state_id || '';
        prevCityIdRef.current = d.city_id || '';
      }
      setFormData((prev) => ({
        ...prev,
        address: d.address || d.address_line || d.suggestion_main,
        pincode: d.pincode || prev.pincode,
        // The shop's point comes from the picked address; it is saved with the party.
        address_lat: d.latitude ?? null,
        address_lng: d.longitude ?? null,
        ...(d.country_id ? { country_id: d.country_id, state_id: d.state_id || '', city_id: d.city_id || '', zone_id: '' } : {}),
      }));
      if (d.added && d.added.length) showSuccess(`Added to your lists: ${d.added.join(', ')}.`);
    } finally {
      setTimeout(() => { isInitializingEditRef.current = false; }, 300);
    }
  };

  const handleRemoveLocation = async () => {
    const partyId = editRow?.id || editRow?.party_id;
    if (!partyId) return;
    if (!(await confirm('Remove this party\'s saved location? Visit orders and check-ins stay blocked until its address is picked again in Edit party.'))) {
      return;
    }
    try {
      setSavingLoc(true);
      await removePartyLocation(partyId);
      const cleared = { latitude: null, longitude: null, location_source: null, location_accuracy_m: null };
      if (onLocationRemoved) onLocationRemoved(partyId, cleared);
      setEditRow((prev) => (prev ? { ...prev, ...cleared } : prev));
      setFormData((prev) => ({ ...prev, ...cleared }));
      showSuccess('Location removed. Pick the address again in Edit party to set it.');
    } catch (err) {
      showError(err?.message || 'Could not remove the location. Please try again.');
    } finally {
      setSavingLoc(false);
    }
  };

  const finish = () => {
    setSaving(false);
    if (onClose) onClose();
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (saving) return;

    const problem = validatePartyForm(formData, { isEditing: !!editRow });
    if (problem) { showError(problem); return; }

    const dataToSend = buildPartyPayload(formData, { isAdmin });

    try {
      setSaving(true);

      if (editRow) {
        const partyId = editRow.id || editRow.party_id || editRow._id;
        if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
          console.error('EditRow missing or invalid ID:', editRow);
          showError('Party ID is missing or invalid. Please refresh and try again.');
          setSaving(false);
          return;
        }
        try {
          const updatedParty = await updateParty(partyId.trim(), dataToSend);
          showSuccess(updatedParty?.location_reset
            ? 'Party updated. The address changed, so the saved shop spot was cleared. The new address sets the location; the next visit saves the exact spot.'
            : 'Party updated successfully!');
          if (onSaved) await onSaved(updatedParty, { mode: 'edit', payload: dataToSend, partyId: partyId.trim() });
          finish();
        } catch (apiError) {
          const errorMsg = String(apiError.message || apiError.error || 'Failed to update party');
          if (isInitializationError(apiError)) {
            // Backend timing quirk: reload to verify whether the update landed.
            try {
              showSuccess('Party updated successfully!');
              if (onSaved) await onSaved(null, { mode: 'edit', payload: dataToSend, refetch: true });
              finish();
            } catch (fetchError) {
              console.error('[Update] Failed to refresh data:', fetchError);
              showError(errorMsg);
              setSaving(false);
            }
          } else {
            showError(errorMsg);
            setSaving(false);
          }
        }
        return;
      }

      // Create. The backend creates the party's login user itself and assigns the salesman or
      // distributor, so nothing else is sent here.
      try {
        const newParty = await createParty(dataToSend);
        const noLocation = newParty?.location_status === 'none';
        if (noLocation) {
          showWarning('Party created, but no location was found for this address. Pick the address from the suggestions so the shop gets a location.');
        } else {
          showSuccess('Party created successfully!');
        }
        if (onSaved) await onSaved(newParty, { mode: 'add', payload: dataToSend });
        // Reopen the new party so the address can be picked from the suggestions right now.
        if (noLocation && (newParty?.party_id || newParty?.id)) {
          setSaving(false);
          await loadInto({ ...newParty, id: newParty.party_id || newParty.id });
          return;
        }
        finish();
      } catch (error) {
        if (!isForeignKeyError(error)) throw error;
        // A location id the server does not know: retry without it.
        const retryData = { ...dataToSend };
        const fields = foreignKeyFields(error);
        const names = { state_id: 'State ID', city_id: 'City ID', zone_id: 'Zone ID' };
        fields.forEach((f) => {
          retryData[f] = null;
          setFormData((prev) => ({ ...prev, [f]: '' }));
        });
        let note;
        let created;
        if (fields.length > 0) {
          try {
            created = await createParty(retryData);
            note = `Party created successfully! (${fields.map((f) => names[f]).join(', ')} set to null due to invalid references)`;
          } catch (retryError) {
            if (!isForeignKeyError(retryError)) throw retryError;
            retryData.state_id = null;
            retryData.city_id = null;
            retryData.zone_id = null;
            created = await createParty(retryData);
            note = 'Party created successfully! (All location IDs set to null due to invalid references)';
          }
        } else {
          retryData.state_id = null;
          retryData.city_id = null;
          retryData.zone_id = null;
          created = await createParty(retryData);
          note = 'Party created successfully! (All location IDs set to null due to invalid references)';
        }
        showSuccess(note);
        if (onSaved) await onSaved(created, { mode: 'add', payload: retryData, refetch: true });
        finish();
      }
    } catch (error) {
      if (!isAuthExpiredError(error)) {
        if (isInitializationError(error)) {
          // Already handled by the server's timing quirk: reload to check.
          try { if (onSaved) await onSaved(null, { mode: editRow ? 'edit' : 'add', refetch: true }); } catch { /* the list is refreshed by hand */ }
          showError('Table data may not be updated. Please refresh the page to verify.');
          finish();
          return;
        }
        showError(friendlySaveError(error));
      }
      setSaving(false);
    }
  };

  const partyField = (label, req, node, hint) => (
    <div className="pf-field">
      <label className="ui-label">{label}{req ? ' *' : ''}</label>
      {node}
      {hint}
    </div>
  );
  const creditLocked = !!editRow && !isPartyManager;

  const renderPartyFormFields = () => (
    <div className="pf rf-form">
      <FormProgress label="Name, address, terms" done={progressDone(formData)} total={9} />
      <section className="pf-sec" aria-labelledby="pf-h-party">
        <h3 id="pf-h-party" className="pf-sec__h">Party</h3>
        <p className="pf-sec__d">Who the shop is and how to reach it.</p>
        <div className="pf-grid">
          {partyField('Party name', true, (
            <input className="ui-input" placeholder="Party name" value={formData.party_name}
              onChange={(e) => handleInputChange('party_name', e.target.value)} required />
          ))}
          {partyField('Trade name', true, (
            <input className="ui-input" placeholder="Trade name" value={formData.trade_name}
              onChange={(e) => handleInputChange('trade_name', e.target.value)} required />
          ))}
          {partyField('Contact person', true, (
            <input className="ui-input" placeholder="Contact person" value={formData.contact_person}
              onChange={(e) => handleInputChange('contact_person', e.target.value)} required />
          ))}
          {partyField('Phone', true, (
            <PhoneInput
              defaultCountry="in"
              value={formData.phone ? (String(formData.phone).startsWith('+') ? String(formData.phone) : '+' + formData.phone) : ''}
              onChange={(phone) => handleInputChange('phone', phone.replace(/^\+/, ''))}
              className="phone-intl"
              inputProps={{ required: true, placeholder: 'Enter your phone number' }}
            />
          ))}
          {partyField('Email', false, (
            <input className="ui-input" type="email" placeholder="Optional" value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)} />
          ))}
        </div>
      </section>

      <section className="pf-sec" aria-labelledby="pf-h-ship">
        <h3 id="pf-h-ship" className="pf-sec__h">Shipping address</h3>
        <p className="pf-sec__d">Search once and the rest fills in.</p>
        <div className="pf-grid">
          <div className="pf-field pf-field--full">
            <label className="ui-label">Address *</label>
            <AddressAutocomplete
              value={formData.address}
              onChange={(text) => setFormData((prev) => ({ ...prev, address: text, address_lat: null, address_lng: null }))}
              onPick={handleAddressPick}
              showStatus={isAdmin || userRole === 'party_manager' || userRole === 'sales_manager'}
            />
          </div>
          {partyField('Country', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select Country' }, ...countries.map((country) => ({ value: country.id, label: country.name }))]}
              value={formData.country_id || ''}
              onChange={(value) => handleInputChange('country_id', value || '')}
              onOpen={fetchCountries}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          ))}
          {partyField('State', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select State' }, ...states.map((state) => ({ value: state.id, label: state.name }))]}
              value={formData.state_id || ''}
              onChange={(value) => handleInputChange('state_id', value || '')}
              placeholder="Select State"
              disabled={!formData.country_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.country_id && <small className="pf-hint">Please select a country first</small>)}
          {partyField('City', true, (
            <DropdownSelector
              options={[{ value: '', label: 'Select City' }, ...cities.map((city) => ({ value: city.id, label: city.name }))]}
              value={formData.city_id || ''}
              onChange={(value) => handleInputChange('city_id', value || '')}
              placeholder="Select City"
              disabled={!formData.state_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.state_id && <small className="pf-hint">Please select a state first</small>)}
          {partyField('Pincode', true, (
            <input className="ui-input" inputMode="numeric" placeholder="Pincode" value={formData.pincode}
              onChange={(e) => handleInputChange('pincode', e.target.value)} />
          ))}
          {partyField('Zone', false, (
            <DropdownSelector
              options={[{ value: '', label: 'Select Zone' }, ...zones.map((zone) => ({ value: zone.id, label: zone.name }))]}
              value={formData.zone_id || ''}
              onChange={(value) => handleInputChange('zone_id', value || '')}
              placeholder="Select Zone"
              disabled={!formData.city_id}
              className="ui-dropdown-custom--full-width"
            />
          ), !formData.city_id && <small className="pf-hint">Please select a city first</small>)}
          <div className="pf-field pf-field--full">
            <button
              type="button"
              role="switch"
              aria-checked={formData.billing_same_as_shipping !== false}
              className={`pf-switch ${formData.billing_same_as_shipping !== false ? 'is-on' : ''}`}
              onClick={() => handleInputChange('billing_same_as_shipping', formData.billing_same_as_shipping === false)}
            >
              <span className="pf-switch__track" aria-hidden="true"><span className="pf-switch__dot" /></span>
              <span className="pf-switch__text">
                <b>Billing address is the same</b>
                <small>Turn off to enter a different billing address</small>
              </span>
            </button>
          </div>
          {formData.billing_same_as_shipping === false && (
            <div className="pf-field pf-field--full">
              <label className="ui-label">Billing address</label>
              <textarea
                className="ui-input"
                rows={2}
                style={{ minHeight: 64, resize: 'vertical', lineHeight: 1.4 }}
                placeholder="Billing address"
                value={formData.billing_address}
                onChange={(e) => handleInputChange('billing_address', e.target.value)}
              />
            </div>
          )}
          {(isAdmin || isSalesman || isDistributor || userRole === 'party_manager' || userRole === 'sales_manager') && (() => {
            const locLat = editRow?.latitude ?? formData.latitude;
            const locLng = editRow?.longitude ?? formData.longitude;
            const locSource = editRow?.location_source || formData.location_source;
            const hasLocationSet = locLat !== null && locLat !== undefined && locLat !== '' && locLng !== null && locLng !== undefined && locLng !== ''
              && Number.isFinite(Number(locLat)) && Number.isFinite(Number(locLng));
            const isVerified = locSource === 'verified';
            const pickedNow = Number.isFinite(Number(formData.address_lat)) && formData.address_lat !== null && formData.address_lat !== '';
            const canRemoveLocation = !!editRow && hasLocationSet
              && (isAdmin || userRole === 'party_manager' || userRole === 'sales_manager');
            return (
              <div className="pf-field pf-field--full party-loc">
                <label className="ui-label">Shop location</label>
                <div className="party-loc__chip">
                  <span className={`loc-pill loc-pill--${isVerified || pickedNow ? 'ok' : hasLocationSet ? 'warn' : 'idle'}`}>
                    {isVerified ? 'Exact spot saved' : pickedNow ? 'From the picked address' : hasLocationSet ? 'From the address' : 'Not set'}
                  </span>
                </div>
                <p className="mt-0 mb-2 text-[length:var(--text-xs)] text-text-muted">
                  {isVerified
                    ? 'The exact shop spot was saved on a visit. Visit orders and check-ins must be within 50 m of it.'
                    : pickedNow
                      ? 'The location comes from the picked address and is saved with the party. The first visit order or check-in saves the exact spot.'
                      : hasLocationSet
                        ? 'The location comes from the address. Until the first visit saves the exact spot, a visit can be within 150 m.'
                        : 'Pick the address from the suggestions above. That sets the shop location.'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {canRemoveLocation && (
                    <button type="button" className="ui-btn ui-btn--secondary" onClick={handleRemoveLocation} disabled={savingLoc}>
                      {savingLoc ? 'Removing…' : 'Remove location'}
                    </button>
                  )}
                  {hasLocationSet && (
                    <a
                      className="ui-btn ui-btn--secondary inline-flex items-center gap-1"
                      href={`https://www.google.com/maps/search/?api=1&query=${Number(locLat)},${Number(locLng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on map
                    </a>
                  )}
                </div>
                {hasLocationSet && (
                  <p className="mt-2 mb-0 text-[length:var(--text-xs)] text-text-subtle">
                    {Number(locLat).toFixed(5)}, {Number(locLng).toFixed(5)}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      <section className="pf-sec" aria-labelledby="pf-h-terms">
        <h3 id="pf-h-terms" className="pf-sec__h">Terms</h3>
        <div className="pf-grid">
          {partyField('Preferred courier', !editRow, (
            <input className="ui-input" placeholder="Choose a courier" value={formData.prefered_courier}
              onChange={(e) => handleInputChange('prefered_courier', e.target.value)} />
          ))}
          {partyField('Credit days', false, (
            <input disabled={creditLocked} className="ui-input" type="number" inputMode="numeric" min="0"
              placeholder={creditLocked ? 'Set by your manager' : 'Credit days'}
              value={formData.credit_days} onChange={(e) => handleInputChange('credit_days', e.target.value)} />
          ), creditLocked && <small className="pf-hint">Only managers can change this.</small>)}
          {partyField('GSTIN', false, (
            <input disabled={creditLocked} className="ui-input" placeholder="GSTIN" value={formData.gstin}
              onChange={(e) => handleInputChange('gstin', e.target.value)} />
          ))}
          {partyField('PAN', false, (
            <input disabled={creditLocked} className="ui-input" placeholder="PAN" value={formData.pan}
              onChange={(e) => handleInputChange('pan', e.target.value)} />
          ))}
          {!isPartyManager && (
            <div className="pf-field pf-field--full">
              <p className="ord-view__lock party-form__lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" /></svg><span>Login status, credit days, GSTIN and PAN can be changed by admin, party and sales managers only.</span></p>
            </div>
          )}
          {editRow && isAdmin && (
            <div className="pf-field pf-field--full">
              <button
                type="button"
                role="switch"
                aria-checked={formData.is_active !== false}
                className={`pf-switch ${formData.is_active !== false ? 'is-on' : ''}`}
                onClick={() => handleInputChange('is_active', formData.is_active === false)}
              >
                <span className="pf-switch__track" aria-hidden="true"><span className="pf-switch__dot" /></span>
                <span className="pf-switch__text">
                  <b>Active</b>
                  <small>Switch off to make the party inactive. Nothing is deleted.</small>
                </span>
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const editing = !!editRow;

  return (
    <AsidePanel
      open={!!open && ready}
      onClose={onClose}
      title={editing ? 'Edit party' : 'Add party'}
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update party' : 'Save party')}
          </button>
        </>
      )}
    >
      <form className="ui-form" onSubmit={handleSubmit}>
        {renderPartyFormFields()}
      </form>
    </AsidePanel>
  );
}
