'use client';
import React, { useEffect, useMemo, useState } from 'react';
import AsidePanel from '../components/ui/AsidePanel';
import PagedMultiSelect from '../components/ui/PagedMultiSelect';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { FormSec } from '../components/forms/FormBits';
import { PageHead, Card, StateBox, Field, SwitchRow, KpiRow, Kpi, useRetailLoad, errorText } from '../components/retail/RetailBits';
import { getRetailSettings, updateRetailSettings, retailData } from '../services/api/retailApi';
import { getIndianCountries, getStates } from '../services/api/geoApi';
import { showSuccess, showError } from '../services/notificationService';
import { rupees, count } from '../utils/retailFormat';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const toForm = (s = {}) => ({
  free_over: s.free_over ?? '',
  cod_enabled: s.cod_enabled !== false,
  cod_fee: s.cod_fee ?? 0,
  express_enabled: !!s.express_enabled,
  express_charge: s.express_charge ?? 0,
  packing_days: s.packing_days ?? 1,
  zones: Array.isArray(s.zones) ? s.zones.map((z) => ({ name: z.name || '', states: Array.isArray(z.states) ? z.states : [], days_min: z.days_min ?? '', days_max: z.days_max ?? '', charge: z.charge ?? 0 })) : [],
  blocked: Array.isArray(s.blocked_pincodes) ? s.blocked_pincodes.join('\n') : '',
});

const parsePins = (text) => Array.from(new Set(String(text || '').split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)));
const days = (z) => (z.days_min !== '' && z.days_max !== '' ? (Number(z.days_min) === Number(z.days_max) ? `${z.days_min} days` : `${z.days_min} to ${z.days_max} days`) : '—');

// Shipping: free-shipping amount, cash on delivery, express, zones and rates, blocked pincodes, packing time.
export default function RetailShipping() {
  const confirm = useConfirm();
  const { data, loading, error, reload } = useRetailLoad(async () => retailData(await getRetailSettings()) || {}, []);
  const [form, setForm] = useState(null);
  const [base, setBase] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [zone, setZone] = useState(null); // { index, ...zone }
  const [zoneErr, setZoneErr] = useState({});
  const [allStates, setAllStates] = useState([]);

  useEffect(() => {
    if (data) { setBase(data.shipping || {}); setForm(toForm(data.shipping || {})); setDirty(false); }
  }, [data]);

  // Zones pick from the states Stallion already has (Manage > states), so names always match the address form.
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const c = await getIndianCountries();
        const list = Array.isArray(c) ? c : (c?.data || []);
        const id = list[0]?.country_id || list[0]?.id;
        if (!id) return;
        const st = await getStates(id);
        if (!off) setAllStates(st.map((s) => s.name || s.state_name).filter(Boolean).sort());
      } catch { /* the zone form still works: states can be typed below */ }
    })();
    return () => { off = true; };
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true); };

  const validate = () => {
    const e = {};
    const money = (k, label) => { if (form[k] !== '' && (Number.isNaN(Number(form[k])) || Number(form[k]) < 0)) e[k] = `${label} must be 0 or more.`; };
    money('free_over', 'The free-shipping amount'); money('cod_fee', 'The fee'); money('express_charge', 'The charge');
    if (form.packing_days === '' || !Number.isInteger(Number(form.packing_days)) || Number(form.packing_days) < 0 || Number(form.packing_days) > 30) e.packing_days = 'Enter whole days between 0 and 30.';
    const bad = parsePins(form.blocked).filter((p) => !/^[1-9][0-9]{5}$/.test(p));
    if (bad.length) e.blocked = `These are not valid 6 digit pincodes: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '...' : ''}`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateRetailSettings({
        shipping: {
          ...base,
          free_over: form.free_over === '' ? null : Number(form.free_over),
          cod_enabled: !!form.cod_enabled,
          cod_fee: Number(form.cod_fee) || 0,
          express_enabled: !!form.express_enabled,
          express_charge: Number(form.express_charge) || 0,
          packing_days: Number(form.packing_days),
          zones: form.zones.map((z) => ({ name: z.name, states: z.states, days_min: Number(z.days_min), days_max: Number(z.days_max), charge: Number(z.charge) || 0 })),
          blocked_pincodes: parsePins(form.blocked),
        },
      });
      showSuccess('Shipping rules saved');
      setDirty(false);
      reload();
    } catch (e) {
      showError(errorText(e), null, 'Could not save the shipping rules');
    } finally {
      setSaving(false);
    }
  };

  const openZone = (index) => {
    setZoneErr({});
    setZone(index === null ? { index: null, name: '', states: [], days_min: 3, days_max: 5, charge: 0 } : { index, ...form.zones[index] });
  };
  const saveZone = () => {
    const e = {};
    if (!zone.name.trim()) e.name = 'Name the zone, for example West India.';
    if (zone.states.length === 0) e.states = 'Pick at least one state.';
    const a = Number(zone.days_min); const b = Number(zone.days_max);
    if (!Number.isInteger(a) || a < 0 || !Number.isInteger(b) || b < a) e.days = 'Enter whole days; the last day cannot be before the first.';
    if (zone.charge === '' || Number.isNaN(Number(zone.charge)) || Number(zone.charge) < 0) e.charge = 'Enter the charge in rupees (0 for free).';
    setZoneErr(e);
    if (Object.keys(e).length) return;
    const z = { name: zone.name.trim(), states: zone.states, days_min: a, days_max: b, charge: Number(zone.charge) };
    set('zones', zone.index === null ? [...form.zones, z] : form.zones.map((x, i) => (i === zone.index ? z : x)));
    setZone(null);
  };
  const removeZone = async (i) => {
    const ok = await confirm({ title: 'Remove this zone?', message: 'Orders to these states will use no zone rate until you add one. Press Save to apply.', confirmLabel: 'Remove zone', danger: true });
    if (ok) set('zones', form.zones.filter((_, idx) => idx !== i));
  };

  const stateOptions = useMemo(() => allStates, [allStates]);
  const statePage = (pg, search) => {
    const t = String(search || '').trim().toLowerCase();
    const list = stateOptions.filter((s) => !t || s.toLowerCase().includes(t));
    return Promise.resolve(list.slice((pg - 1) * 20, pg * 20));
  };

  const blockedCount = form ? parsePins(form.blocked).length : 0;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Shipping" subtitle="Delivery rules for the public store.">
          <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving || !form || !dirty}>{saving ? 'Saving...' : 'Save changes'}</button>
        </PageHead>

        {error && !loading && !form ? (
          <StateBox kind="error" title="Could not load the shipping rules" desc={error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={reload}>Try again</button>} />
        ) : !form ? (
          <span className="ui-skeleton rt-block-skel" aria-busy="true" />
        ) : (
          <>
            <KpiRow>
              <Kpi label="Free shipping over" value={form.free_over === '' ? 'Not set' : rupees(form.free_over)} />
              <Kpi label="Cash on delivery" value={form.cod_enabled ? (Number(form.cod_fee) ? `${rupees(form.cod_fee)} fee` : 'On, no fee') : 'Off'} />
              <Kpi label="Packing time" value={`${count(form.packing_days)} working day${Number(form.packing_days) === 1 ? '' : 's'}`} />
            </KpiRow>

            <Card title="Charges" hint="What customers pay at checkout.">
              <div className="rf-grid rt-grid">
                <Field label="Free shipping over (₹)" hint="Leave empty to never offer free shipping.">
                  <input className="ui-input" type="number" inputMode="decimal" min="0" value={form.free_over} onChange={(e) => set('free_over', e.target.value)} placeholder="For example 1999" />
                  {errors.free_over && <p className="rt-error" role="alert">{errors.free_over}</p>}
                </Field>
                <Field label="Packing time before pickup (working days)">
                  <input className="ui-input" type="number" inputMode="numeric" min="0" max="30" value={form.packing_days} onChange={(e) => set('packing_days', e.target.value)} />
                  {errors.packing_days && <p className="rt-error" role="alert">{errors.packing_days}</p>}
                </Field>
              </div>
              <SwitchRow label="Cash on delivery" hint="Customers pay when the parcel arrives." checked={form.cod_enabled} onChange={(v) => set('cod_enabled', v)} />
              {form.cod_enabled && (
                <Field label="Cash on delivery fee (₹)">
                  <input className="ui-input rt-narrow" type="number" inputMode="decimal" min="0" value={form.cod_fee} onChange={(e) => set('cod_fee', e.target.value)} />
                  {errors.cod_fee && <p className="rt-error" role="alert">{errors.cod_fee}</p>}
                </Field>
              )}
              <SwitchRow label="Express delivery" hint="An extra, faster option at checkout." checked={form.express_enabled} onChange={(v) => set('express_enabled', v)} />
              {form.express_enabled && (
                <Field label="Express charge (₹)">
                  <input className="ui-input rt-narrow" type="number" inputMode="decimal" min="0" value={form.express_charge} onChange={(e) => set('express_charge', e.target.value)} />
                  {errors.express_charge && <p className="rt-error" role="alert">{errors.express_charge}</p>}
                </Field>
              )}
            </Card>

            <Card title="Zones and rates" hint="Group states by delivery time and charge." actions={<button type="button" className="ui-btn ui-btn--secondary" onClick={() => openZone(null)}>Add zone</button>}>
              {form.zones.length === 0 ? <p className="rt-none">No zones yet. Add one to set delivery times and charges by state.</p> : (
                <div className="rt-tablewrap">
                  <table className="rt-tbl">
                    <thead><tr><th>Zone</th><th>States</th><th>Time</th><th className="r">Charge</th><th><span className="rt-sr">Action</span></th></tr></thead>
                    <tbody>
                      {form.zones.map((z, i) => (
                        <tr key={`${z.name}-${i}`}>
                          <td data-label="Zone"><b>{z.name}</b></td>
                          <td data-label="States">{z.states.join(', ')}</td>
                          <td data-label="Time">{days(z)}</td>
                          <td data-label="Charge" className="r">{Number(z.charge) ? rupees(z.charge) : 'Free'}</td>
                          <td className="rt-tbl__act">
                            <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => openZone(i)} aria-label={`Edit ${z.name}`}>Edit</button>
                            <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => removeZone(i)} aria-label={`Remove ${z.name}`}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Pincodes not served" hint="One pincode per line. Customers cannot order to these.">
              <textarea className="ui-input rt-ta" rows={5} value={form.blocked} onChange={(e) => set('blocked', e.target.value)} placeholder="793001" aria-label="Pincodes not served" />
              <p className="rt-hint">{blockedCount} pincode{blockedCount === 1 ? '' : 's'} blocked.</p>
              {errors.blocked && <p className="rt-error" role="alert">{errors.blocked}</p>}
            </Card>
          </>
        )}
      </div>

      <AsidePanel
        open={!!zone}
        onClose={() => setZone(null)}
        title={zone?.index === null ? 'Add zone' : 'Edit zone'}
        footer={(
          <>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setZone(null)}>Cancel</button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={saveZone}>Done</button>
          </>
        )}
      >
        {zone && (
          <div className="rt-form rf-form">
            <FormSec title="Zone" hint="Press Save changes on the page afterwards to apply.">
              <Field label="Zone name *" full>
                <input className="ui-input" value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} placeholder="West India" />
                {zoneErr.name && <p className="rt-error" role="alert">{zoneErr.name}</p>}
              </Field>
              <div className="form-group rf-full">
                <label className="ui-label">States *</label>
                <PagedMultiSelect
                  fetchPage={statePage}
                  mapItem={(s) => ({ value: s, label: s })}
                  selected={zone.states.map((s) => ({ id: s, label: s }))}
                  onToggle={(opt) => setZone((z) => ({ ...z, states: z.states.includes(opt.value) ? z.states.filter((s) => s !== opt.value) : [...z.states, opt.value] }))}
                  onRemove={(id) => setZone((z) => ({ ...z, states: z.states.filter((s) => s !== id) }))}
                  placeholder="Pick states"
                  searchPlaceholder="Search states"
                />
                {zoneErr.states && <p className="rt-error" role="alert">{zoneErr.states}</p>}
              </div>
              <Field label="Fastest delivery (days) *">
                <input className="ui-input" type="number" inputMode="numeric" min="0" value={zone.days_min} onChange={(e) => setZone({ ...zone, days_min: e.target.value })} />
              </Field>
              <Field label="Slowest delivery (days) *">
                <input className="ui-input" type="number" inputMode="numeric" min="0" value={zone.days_max} onChange={(e) => setZone({ ...zone, days_max: e.target.value })} />
                {zoneErr.days && <p className="rt-error" role="alert">{zoneErr.days}</p>}
              </Field>
              <Field label="Shipping charge (₹) *" full hint="0 means free. Orders over the free-shipping amount are free anyway.">
                <input className="ui-input rt-narrow" type="number" inputMode="decimal" min="0" value={zone.charge} onChange={(e) => setZone({ ...zone, charge: e.target.value })} />
                {zoneErr.charge && <p className="rt-error" role="alert">{zoneErr.charge}</p>}
              </Field>
            </FormSec>
          </div>
        )}
      </AsidePanel>
    </div>
  );
}
