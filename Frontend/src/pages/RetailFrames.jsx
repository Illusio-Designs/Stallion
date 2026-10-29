'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import { FiSearch } from '../components/icons/hugeicons';
import { FormSec } from '../components/forms/FormBits';
import { PageHead, Chips, StateBox, Switch, Field, Thumb, Pill, errorText } from '../components/retail/RetailBits';
import {
  getRetailProducts, updateRetailProduct, bulkRetailProducts, syncRetailProducts, retailData, retailList,
} from '../services/api/retailApi';
import { showSuccess, showError } from '../services/notificationService';
import { rupees, count, slugify, lengthHint, TITLE_RANGE, DESC_RANGE } from '../utils/retailFormat';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const PAGE = 20;
const SHOWN = [
  { value: 'all', label: 'All frames' },
  { value: 'true', label: 'On the store' },
  { value: 'false', label: 'Hidden' },
];

const firstImage = (p) => (Array.isArray(p.images) ? p.images.find(Boolean) : p.image) || '';
const emptyForm = (p) => ({
  id: p.id,
  model_no: p.model_no || '',
  title: p.title || '',
  description: p.description || '',
  slug: p.slug || '',
  mrp: p.mrp ?? '',
  stock: p.stock ?? 0,
  show_on_store: !!p.show_on_store,
  is_active: p.is_active !== false,
  seo_title: p.seo_title || '',
  seo_description: p.seo_description || '',
  facts: [p.brand_name, p.shape, p.frame_type, p.frame_material, p.color, p.gender].filter(Boolean).join(' · '),
  image: firstImage(p),
});

// Frames on the store: which catalogue frames the public store shows, with the store's own stock, MRP and text.
export default function RetailFrames() {
  const [shown, setShown] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: '' });
  const [selected, setSelected] = useState([]);
  const [tableKey, setTableKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const slugTouched = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await getRetailProducts({ search: q, shown: shown === 'all' ? '' : shown, page, limit: PAGE });
      if (mine !== seq.current) return;
      const { rows, pagination } = retailList(res);
      setState({ rows, pagination, loading: false, error: '' });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: errorText(e, 'Could not load frames.') }));
    }
  }, [q, shown, page]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const selectedIds = useMemo(() => selected.map((k) => String(k).replace(/^id:/, '')), [selected]);

  const patchRow = (id, patch) => setState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const toggle = async (row, next) => {
    if (togglingId) return;
    setTogglingId(row.id);
    patchRow(row.id, { show_on_store: next });
    try {
      await updateRetailProduct(row.id, { show_on_store: next });
      if (next && Number(row.stock) <= 0) showSuccess('', null, 'Switched on', 'This frame has no stock, so the store keeps it hidden until you add stock.');
    } catch (e) {
      patchRow(row.id, { show_on_store: !next });
      showError(errorText(e), null, 'Could not change this frame');
    } finally {
      setTogglingId('');
    }
  };

  const bulk = async (show) => {
    if (!selectedIds.length) return;
    setBusy(true);
    try {
      await bulkRetailProducts(selectedIds, show);
      showSuccess('', null, show ? 'Frames shown on the store' : 'Frames hidden from the store', `${selectedIds.length} frame${selectedIds.length === 1 ? '' : 's'} updated.`);
      setSelected([]);
      setTableKey((k) => k + 1);
      load();
    } catch (e) {
      showError(errorText(e), null, 'Could not update the frames');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = retailData(await syncRetailProducts()) || {};
      showSuccess('', null, 'Sync finished', `${count(r.created ?? 0)} new, ${count(r.updated ?? 0)} updated, ${count(r.skipped ?? 0)} skipped. New frames start hidden with no stock.`);
      load();
    } catch (e) {
      showError(errorText(e), null, 'Sync did not finish');
    } finally {
      setSyncing(false);
    }
  };

  const openEdit = (row) => { slugTouched.current = true; setErrors({}); setForm(emptyForm(row)); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Enter a title for the store.';
    if (!form.slug.trim()) e.slug = 'Enter the address of the page.';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) e.slug = 'Use lowercase letters, numbers and hyphens only.';
    if (form.mrp === '' || Number.isNaN(Number(form.mrp)) || Number(form.mrp) < 0) e.mrp = 'Enter the MRP in rupees.';
    if (form.stock === '' || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0) e.stock = 'Stock must be a whole number, 0 or more.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateRetailProduct(form.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        slug: form.slug.trim(),
        mrp: Number(form.mrp),
        stock: Number(form.stock),
        show_on_store: form.show_on_store,
        is_active: form.is_active,
        seo_title: form.seo_title.trim(),
        seo_description: form.seo_description.trim(),
      });
      showSuccess('Frame saved');
      setForm(null);
      load();
    } catch (e) {
      showError(errorText(e), null, 'Could not save the frame');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    {
      key: 'title', label: 'Frame',
      render: (_v, r) => (
        <span className="rt-frame">
          <Thumb src={firstImage(r)} alt="" />
          <span className="rt-cell"><b>{r.title || r.model_no}</b><small>{[r.model_no, r.shape, r.frame_material].filter(Boolean).join(' · ')}</small></span>
        </span>
      ),
    },
    { key: 'mrp', label: 'MRP', render: (v) => rupees(v) },
    { key: 'stock', label: 'Stock', render: (v) => (Number(v) > 0 ? <span>{count(v)}{Number(v) <= 5 ? <span className="rt-low"> low</span> : null}</span> : <Pill tone="bad">Out of stock</Pill>) },
    { key: 'show_on_store', label: 'Show on store', render: (v, r) => <Switch checked={!!v} onChange={(next) => toggle(r, next)} label={`Show ${r.title || r.model_no} on the store`} disabled={togglingId === r.id} /> },
    { key: 'actions', label: 'Action', render: (_v, r) => <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => openEdit(r)} aria-label={`Edit ${r.title || r.model_no}`}>Edit</button> },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [togglingId]);

  const total = state.pagination?.total ?? state.rows.length;
  const titleHint = form ? lengthHint(form.seo_title || form.title, TITLE_RANGE) : null;
  const descHint = form ? lengthHint(form.seo_description, DESC_RANGE) : null;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Frames on store" subtitle="Choose which frames the public store shows. Only the MRP is ever shown; wholesale prices stay private.">
          <button type="button" className="ui-btn ui-btn--secondary" onClick={sync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync from catalogue'}</button>
        </PageHead>

        <Chips options={SHOWN} value={shown} onChange={(v) => { setPage(1); setShown(v); }} label="Filter frames" />

        <div className="rt-toolbar">
          <label className="rt-search">
            <FiSearch aria-hidden="true" />
            <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search model number or title" aria-label="Search frames" />
          </label>
        </div>

        {selectedIds.length > 0 && (
          <div className="rt-bulk" role="region" aria-label="Bulk actions">
            <b>{selectedIds.length} selected</b>
            <div>
              <button type="button" className="ui-btn ui-btn--primary" disabled={busy} onClick={() => bulk(true)}>Show on store</button>
              <button type="button" className="ui-btn ui-btn--secondary" disabled={busy} onClick={() => bulk(false)}>Hide from store</button>
            </div>
          </div>
        )}

        {state.error && !state.loading ? (
          <StateBox kind="error" title="Could not load frames" desc={state.error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={load}>Try again</button>} />
        ) : !state.loading && state.rows.length === 0 && !q && shown === 'all' ? (
          <StateBox title="No frames on the store yet" desc="Use Sync from catalogue to copy the frames from Stallion. New frames start hidden, with no stock." action={<button type="button" className="ui-btn ui-btn--primary" onClick={sync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync from catalogue'}</button>} />
        ) : (
          <div className="dash-card full rt-table">
            <TableWithControls
              key={tableKey}
              title="Frames"
              titleAs="h2"
              columns={columns}
              rows={state.rows}
              itemName="Frame"
              loading={state.loading}
              showSerialNumber={false}
              serverPagination
              serverPage={page}
              serverPageCount={state.pagination?.totalPages || 1}
              serverPageSize={PAGE}
              serverTotal={total}
              onServerPageChange={setPage}
              onServerSearch={(term) => { setPage(1); setQInput(term); }}
              onSelectionChange={setSelected}
            />
          </div>
        )}
        <p className="rt-hint">Frames with no stock are hidden from customers automatically.</p>
      </div>

      <AsidePanel
        open={!!form}
        onClose={() => setForm(null)}
        title="Edit frame"
        footer={(
          <>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save frame'}</button>
          </>
        )}
      >
        {form && (
          <div className="rt-form rf-form">
            <div className="rt-formhead">
              <Thumb src={form.image} alt="" />
              <span className="rt-cell"><b>{form.model_no}</b><small>{form.facts || 'From the Stallion catalogue'}</small></span>
            </div>

            <FormSec title="On the store">
              <Field label="Title *" full>
                <input className="ui-input" value={form.title} onChange={(e) => { set('title', e.target.value); }} />
                {errors.title && <p className="rt-error" role="alert">{errors.title}</p>}
              </Field>
              <Field label="Description" full>
                <textarea className="ui-input rt-ta" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="A few lines about the frame for customers" />
              </Field>
              <Field label="Page address (slug) *" full hint="The frame page is /shop/your-address">
                <input className="ui-input" value={form.slug} onChange={(e) => { slugTouched.current = true; set('slug', e.target.value.toLowerCase()); }} onBlur={() => set('slug', slugify(form.slug))} />
                {errors.slug && <p className="rt-error" role="alert">{errors.slug}</p>}
              </Field>
              <Field label="MRP (₹) *">
                <input className="ui-input" type="number" inputMode="decimal" min="0" step="0.01" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
                {errors.mrp && <p className="rt-error" role="alert">{errors.mrp}</p>}
              </Field>
              <Field label="Stock on the store *" hint="Kept apart from wholesale stock.">
                <input className="ui-input" type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={(e) => set('stock', e.target.value)} />
                {errors.stock && <p className="rt-error" role="alert">{errors.stock}</p>}
              </Field>
              <div className="form-group rf-full rt-switchrow">
                <div><span className="rt-switchrow__l">Show on the store</span><small>Customers can see and buy it while it has stock.</small></div>
                <Switch checked={form.show_on_store} onChange={(v) => set('show_on_store', v)} label="Show on the store" />
              </div>
              <div className="form-group rf-full rt-switchrow">
                <div><span className="rt-switchrow__l">Active</span><small>Switch off to retire the frame. Nothing is deleted.</small></div>
                <Switch checked={form.is_active} onChange={(v) => set('is_active', v)} label="Active" />
              </div>
            </FormSec>

            <FormSec title="Search results" hint="How the frame appears on Google. Leave empty to use the title and description.">
              <Field label={`Search title (${titleHint.n}/60)`} full>
                <input className="ui-input" value={form.seo_title} onChange={(e) => set('seo_title', e.target.value)} />
                <p className={`rt-count rt-count--${titleHint.tone}`}>{titleHint.label}: aim for {TITLE_RANGE[0]} to {TITLE_RANGE[1]} characters</p>
              </Field>
              <Field label={`Search description (${descHint.n}/155)`} full>
                <textarea className="ui-input rt-ta" rows={3} value={form.seo_description} onChange={(e) => set('seo_description', e.target.value)} />
                <p className={`rt-count rt-count--${descHint.tone}`}>{descHint.label}: aim for {DESC_RANGE[0]} to {DESC_RANGE[1]} characters</p>
              </Field>
            </FormSec>
          </div>
        )}
      </AsidePanel>
    </div>
  );
}
