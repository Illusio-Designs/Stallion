import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from '../components/ui/DatePicker';
import AsidePanel from '../components/ui/AsidePanel';
import PagedMultiSelect from '../components/ui/PagedMultiSelect';
import {
  getOffers,
  createOffer,
  updateOffer,
  setOfferActive,
  getProductsPage,
  getProductsByIds,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-orders.css';
import '../styles/redesign-n-offers.css';
import '../styles/redesign-p-offers.css';

const TYPE_LABELS = { flat: 'Flat (whole order)', product: 'Product-wise', bogo: 'Buy X get Y' };
const TYPE_OPTIONS = [
  { value: 'flat', label: 'Flat' },
  { value: 'product', label: 'Product-wise' },
  { value: 'bogo', label: 'Buy X get Y' },
];
const MODE_OPTIONS = [
  { value: 'percent', label: 'Percent' },
  { value: 'amount', label: 'Amount (₹)' },
];

const emptyForm = () => ({
  offer_id: null,
  title: '',
  offer_type: 'flat',
  is_active: true,
  priority: 0,
  start_date: '',
  end_date: '',
  // flat / product
  discount_mode: 'percent',
  discount_value: '',
  min_order_amount: '',
  // product / bogo scope
  products: [], // [{ id, label }]
  all_products: false, // apply to EVERY product (no manual selection)
  // bogo
  buy_qty: 2,
  get_qty: 1,
  get_discount_percent: 100,
});

// Build the backend `config` from the form.
const buildConfig = (f) => {
  if (f.offer_type === 'flat') {
    return {
      discount_mode: f.discount_mode,
      discount_value: Number(f.discount_value) || 0,
      ...(f.min_order_amount !== '' ? { min_order_amount: Number(f.min_order_amount) || 0 } : {}),
    };
  }
  if (f.offer_type === 'product') {
    if (f.all_products) {
      return {
        all_products: true,
        discount_mode: f.discount_mode,
        discount_value: Number(f.discount_value) || 0,
      };
    }
    return {
      items: f.products.map((p) => ({
        product_id: p.id,
        discount_mode: f.discount_mode,
        discount_value: Number(f.discount_value) || 0,
      })),
    };
  }
  // bogo
  if (f.all_products) {
    return {
      all_products: true,
      buy_qty: Number(f.buy_qty) || 0,
      get_qty: Number(f.get_qty) || 0,
      get_discount_percent: Number(f.get_discount_percent) || 100,
    };
  }
  return {
    product_ids: f.products.map((p) => p.id),
    buy_qty: Number(f.buy_qty) || 0,
    get_qty: Number(f.get_qty) || 0,
    get_discount_percent: Number(f.get_discount_percent) || 100,
  };
};

// Short text for the table DISCOUNT column.
const summarise = (offer) => {
  const c = offer.config || {};
  if (offer.offer_type === 'flat') {
    return c.discount_mode === 'percent' ? `${c.discount_value}% off order` : `₹${c.discount_value} off order`;
  }
  if (offer.offer_type === 'product') {
    if (c.all_products) {
      const each = c.discount_mode === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`;
      return `${each} off · all products`;
    }
    const it = (c.items || [])[0] || {};
    const n = (c.items || []).length;
    const each = it.discount_mode === 'percent' ? `${it.discount_value}%` : `₹${it.discount_value}`;
    return `${each} off · ${n} product${n === 1 ? '' : 's'}`;
  }
  if (offer.offer_type === 'bogo') {
    const scope = c.all_products ? 'all products' : `${(c.product_ids || []).length} product(s)`;
    const pct = c.get_discount_percent == null ? 100 : Number(c.get_discount_percent);
    const getText = pct >= 100 ? 'free' : `${pct}% off`;
    return `Buy ${c.buy_qty} Get ${c.get_qty} ${getText} · ${scope}`;
  }
  return '—';
};

const localYmd = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const ChipGroup = ({ label, options, value, onChange }) => (
  <div className="pof-chips" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        className={`pof-chip${value === o.value ? ' on' : ''}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const isEnded = (o) => {
  if (!o.end_date) return false;
  const e = new Date(o.end_date);
  return !Number.isNaN(e.getTime()) && e.getTime() < Date.now();
};

const DashboardOffers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const fetchOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOffers();
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || 'Failed to load offers';
      setError(message);
      setOffers([]);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOffers(); }, []);

  // One page (20) of products for the scope picker — passed to PagedMultiSelect.
  const fetchProductPage = (page, search) => getProductsPage(page, 20, search || '', { activeOnly: true });
  const mapProduct = (p) => ({
    value: String(p.product_id || p.id),
    label: p.model_no || p.product_name || p.name || String(p.product_id || p.id),
  });

  const toggleProduct = (opt) => {
    setForm((f) => f.products.some((p) => p.id === opt.value)
      ? { ...f, products: f.products.filter((p) => p.id !== opt.value) }
      : { ...f, products: [...f.products, { id: opt.value, label: opt.label }] });
  };
  const removeProduct = (id) => setForm((f) => ({ ...f, products: f.products.filter((p) => p.id !== id) }));

  const openAdd = () => { setForm(emptyForm()); setPanelOpen(true); };

  const openEdit = async (offer) => {
    const c = offer.config || {};
    const isFlat = offer.offer_type === 'flat';
    const isProduct = offer.offer_type === 'product';
    const allProducts = c.all_products === true;
    const firstItem = (c.items || [])[0] || {};
    const products = allProducts
      ? []
      : (isProduct
        ? (c.items || []).map((it) => ({ id: String(it.product_id), label: String(it.product_id) }))
        : (c.product_ids || []).map((id) => ({ id: String(id), label: String(id) })));
    // The offer stores only product ids; fetch the model numbers so the chips read properly.
    if (products.length > 0) {
      try {
        const found = await getProductsByIds(products.map((p) => p.id));
        const names = new Map(found.map((p) => [String(p.product_id || p.id), p.model_no || p.product_name || p.name]));
        products.forEach((p) => { p.label = names.get(p.id) || p.label; });
      } catch { /* keep ids as labels */ }
    }
    // For product offers the rate lives per-item, EXCEPT all_products where it's
    // top-level; flat keeps it top-level too.
    const rateSource = (isFlat || (isProduct && allProducts)) ? c : firstItem;
    setForm({
      offer_id: offer.offer_id,
      title: offer.title || '',
      offer_type: offer.offer_type || 'flat',
      is_active: offer.is_active !== false,
      priority: offer.priority || 0,
      start_date: offer.start_date ? localYmd(offer.start_date) : '',
      end_date: offer.end_date ? localYmd(offer.end_date) : '',
      discount_mode: rateSource.discount_mode || 'percent',
      discount_value: rateSource.discount_value ?? '',
      min_order_amount: c.min_order_amount ?? '',
      products,
      all_products: allProducts,
      buy_qty: c.buy_qty ?? 2,
      get_qty: c.get_qty ?? 1,
      get_discount_percent: c.get_discount_percent ?? 100,
    });
    setPanelOpen(true);
  };

  const validate = () => {
    if (!form.title.trim()) return 'Title is required';
    if (form.offer_type === 'flat') {
      if (!form.discount_value || Number(form.discount_value) <= 0) return 'Enter a discount value greater than 0';
      if (form.discount_mode === 'percent' && Number(form.discount_value) > 100) return 'Percent discount cannot exceed 100';
    }
    if (form.offer_type === 'product') {
      if (!form.all_products && form.products.length === 0) return 'Select at least one product (or tick “Apply to all products”)';
      if (!form.discount_value || Number(form.discount_value) <= 0) return 'Enter a discount value greater than 0';
    }
    if (form.offer_type === 'bogo') {
      if (!form.all_products && form.products.length === 0) return 'Select at least one product (or tick “Apply to all products”)';
      if (!form.buy_qty || Number(form.buy_qty) <= 0) return 'Buy quantity must be greater than 0';
      if (!form.get_qty || Number(form.get_qty) <= 0) return 'Get quantity must be greater than 0';
    }
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      return 'End date must be after start date';
    }
    return null;
  };

  const handleSubmit = async () => {
    const v = validate();
    if (v) { showError(v); return; }
    const payload = {
      offer_type: form.offer_type,
      title: form.title.trim(),
      is_active: !!form.is_active,
      priority: Number(form.priority) || 0,
      start_date: form.start_date ? `${form.start_date}T00:00:00` : null,
      end_date: form.end_date ? `${form.end_date}T23:59:59` : null,
      config: buildConfig(form),
    };
    setSaving(true);
    try {
      if (form.offer_id) {
        await updateOffer(form.offer_id, payload);
        showSuccess('Offer updated');
      } else {
        await createOffer(payload);
        showSuccess('Offer created');
      }
      await fetchOffers();
      setPanelOpen(false);
    } catch (err) {
      showError(err?.message || 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  // Active / Inactive switch: optimistic, rolled back if the save fails.
  const [togglingId, setTogglingId] = useState(null);
  const handleToggle = async (offer) => {
    const id = offer.offer_id;
    if (!id || togglingId === id) return;
    const next = offer.is_active === false;
    setTogglingId(id);
    setOffers((list) => list.map((o) => (o.offer_id === id ? { ...o, is_active: next } : o)));
    try {
      await setOfferActive(id, next);
      showSuccess('', null, next ? 'Offer is active' : 'Offer switched off', `"${offer.title}" ${next ? 'is now shown to customers.' : 'is hidden. You can switch it back on any time.'}`);
    } catch (err) {
      setOffers((list) => list.map((o) => (o.offer_id === id ? { ...o, is_active: !next } : o)));
      showError('', null, 'Could not update the offer', err?.message || 'Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const validityLine = (o) => {
    const parts = [summarise(o)];
    if (o.start_date || o.end_date) {
      parts.push(o.start_date && o.end_date ? `${fmtDate(o.start_date)} to ${fmtDate(o.end_date)}` : o.start_date ? `From ${fmtDate(o.start_date)}` : `Until ${fmtDate(o.end_date)}`);
    }
    return parts.join(' · ');
  };

  const current = offers.filter((o) => !isEnded(o));
  const ended = offers.filter((o) => isEnded(o));

  const renderRow = (o) => {
    const active = o.is_active !== false;
    const dates = o.start_date && o.end_date
      ? `${fmtDate(o.start_date)} to ${fmtDate(o.end_date)}`
      : o.start_date ? `From ${fmtDate(o.start_date)}` : o.end_date ? `Until ${fmtDate(o.end_date)}` : 'No dates set';
    return (
      <div className={`pof-row${active ? '' : ' is-off'}`} key={o.offer_id}>
        <div className="pof-row__main">
          <h3>{o.title}</h3>
          <p><b>{summarise(o)}</b></p>
          <p>{TYPE_LABELS[o.offer_type] || 'Offer'} · {dates}</p>
        </div>
        <div className="pof-row__act">
          <button className="ui-btn ui-btn--secondary pof-edit" onClick={() => openEdit(o)}>Edit</button>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={`${o.title}: ${active ? 'On' : 'Off'}`}
            className={`tgl pof-tgl${active ? ' on' : ''}`}
            disabled={togglingId === o.offer_id}
            onClick={() => handleToggle(o)}
          />
        </div>
      </div>
    );
  };
  const renderGroup = (list, heading) => (
    <section className="pof-group">
      {heading && <h2 className="pof-group__h">{heading} <span className="pof-count">{list.length}</span></h2>}
      {list.length === 0
        ? <p className="pof-none">No running offers. Ended offers are listed below.</p>
        : <div className="dash-card pof-list">{list.map(renderRow)}</div>}
    </section>
  );

  const showScope = form.offer_type === 'product' || form.offer_type === 'bogo';
  const showRate = form.offer_type === 'flat' || form.offer_type === 'product';

  return (
    <div className="dash-page w-full offers-page">
      <div className="dash-container flex flex-col gap-4">
        <div className="page-head">
          <div>
            <h1>Offers</h1>
            <p>Discounts shown on the home page and in the cart. Switch one off to hide it; offers are never deleted.</p>
          </div>
          <div className="page-head__actions">
            <button className="ui-btn ui-btn--secondary" onClick={fetchOffers} disabled={loading}>Refresh</button>
            {offers.length > 0 && <button className="ui-btn ui-btn--primary" onClick={openAdd}>Add offer</button>}
          </div>
        </div>

        {error && !loading ? (
          <div className="dash-card ui-state ui-state--error">
            <div className="ui-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="ui-state__title">Couldn't load offers</p>
            <p className="ui-state__desc">{error}</p>
            <button className="ui-btn ui-btn--secondary" onClick={fetchOffers}>Try again</button>
          </div>
        ) : loading && offers.length === 0 ? (
          <div className="pof-list" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="pof-row"><span className="ui-skeleton" style={{ display: 'block', height: 44, width: '100%', borderRadius: 10 }} /></div>)}
          </div>
        ) : offers.length === 0 ? (
          <div className="dash-card ui-state ui-state--empty">
            <div className="ui-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <p className="ui-state__title">No offers yet</p>
            <p className="ui-state__desc">Create a flat, product-wise or buy-X-get-Y offer for the cart.</p>
            <button className="ui-btn ui-btn--primary" onClick={openAdd}>Add offer</button>
          </div>
        ) : (
          <>
            {renderGroup(current, null)}
            {ended.length > 0 && renderGroup(ended, 'Ended')}
          </>
        )}
      </div>

      <AsidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={form.offer_id ? 'Edit offer' : 'Add offer'}
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => setPanelOpen(false)} disabled={saving}>Cancel</button>
            <button className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : (form.offer_id ? 'Update' : 'Create')}
            </button>
          </>
        )}
      >
        <div className="pof-form">
          <div className="form-group pof-full">
            <label className="ui-label">Title *</label>
            <input className="ui-input" placeholder="e.g. Diwali 10% off" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="form-group pof-full">
            <label className="ui-label">Type *</label>
            <ChipGroup label="Offer type" options={TYPE_OPTIONS} value={form.offer_type} onChange={(v) => set('offer_type', v)} />
          </div>

          {showRate && (
            <>
              <div className="form-group pof-full">
                <label className="ui-label">Discount mode *</label>
                <ChipGroup label="Discount mode" options={MODE_OPTIONS} value={form.discount_mode} onChange={(v) => set('discount_mode', v)} />
              </div>
              <div className="form-group">
                <label className="ui-label">Value *</label>
                <input type="number" min="0" className="ui-input" placeholder={form.discount_mode === 'percent' ? 'e.g. 10' : 'e.g. 500'} value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} />
              </div>
            </>
          )}

          {form.offer_type === 'flat' && (
            <div className="form-group">
              <label className="ui-label">Minimum order (₹)</label>
              <input type="number" min="0" className="ui-input" placeholder="Optional, e.g. 5000" value={form.min_order_amount} onChange={(e) => set('min_order_amount', e.target.value)} />
            </div>
          )}

          {form.offer_type === 'bogo' && (
            <>
              <div className="form-group">
                <label className="ui-label">Buy qty *</label>
                <input type="number" min="1" className="ui-input" value={form.buy_qty} onChange={(e) => set('buy_qty', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="ui-label">Get qty *</label>
                <input type="number" min="1" className="ui-input" value={form.get_qty} onChange={(e) => set('get_qty', e.target.value)} />
              </div>
              <div className="form-group pof-full">
                <label className="ui-label">Get discount %</label>
                <input type="number" min="0" max="100" className="ui-input" placeholder="100 = free" value={form.get_discount_percent} onChange={(e) => set('get_discount_percent', e.target.value)} />
                <p className="pof-hint">
                  For every {Number(form.buy_qty) || 0} bought, the next {Number(form.get_qty) || 0} get {Number(form.get_discount_percent) >= 100 || form.get_discount_percent === '' ? '100% off (free)' : `${Number(form.get_discount_percent) || 0}% off`}.
                  The cart must contain at least {(Number(form.buy_qty) || 0) + (Number(form.get_qty) || 0)} units of a product before any discount applies.
                </p>
              </div>
            </>
          )}

          {showScope && (
            <div className="form-group pof-full">
              <label className="ui-label">
                Products *{' '}
                <span className="pof-sub">
                  ({form.all_products ? 'all products' : `${form.products.length} selected`})
                </span>
              </label>
              <div className="pof-chips">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.all_products}
                  className={`pof-chip${form.all_products ? ' on' : ''}`}
                  onClick={() => set('all_products', !form.all_products)}
                >
                  Apply to all products
                </button>
              </div>
              {!form.all_products && (
                <PagedMultiSelect
                  fetchPage={fetchProductPage}
                  mapItem={mapProduct}
                  selected={form.products}
                  onToggle={toggleProduct}
                  onRemove={removeProduct}
                  placeholder="Select products"
                  searchPlaceholder="Search products by model no…"
                />
              )}
              {form.all_products && (
                <p className="pof-hint">This offer applies to every product, so there is no need to pick them one by one.</p>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="ui-label">Start date</label>
            <DatePicker value={form.start_date} onChange={(v) => set('start_date', v)} placeholder="Select date" />
          </div>
          <div className="form-group">
            <label className="ui-label">End date</label>
            <DatePicker value={form.end_date} onChange={(v) => set('end_date', v)} placeholder="Select date" />
          </div>

          <div className="form-group">
            <label className="ui-label">Priority</label>
            <input type="number" className="ui-input" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="ui-label">Active</label>
            <button
              type="button"
              role="switch"
              aria-checked={!!form.is_active}
              onClick={() => set('is_active', !form.is_active)}
              className="mng-switch pof-switch"
            >
              <span className={`mng-switch__track ${form.is_active ? 'is-on' : ''}`}>
                <span className="mng-switch__dot" />
              </span>
              <span className="mng-switch__label">{form.is_active ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>
      </AsidePanel>
    </div>
  );
};

export default DashboardOffers;
