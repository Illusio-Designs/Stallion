import React, { useEffect, useMemo, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import StatusBadge from '../components/ui/StatusBadge';
import DropdownSelector from '../components/ui/DropdownSelector';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  getProductsPage,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-orders.css';

const TYPE_LABELS = { flat: 'Flat (whole order)', product: 'Product-wise', bogo: 'Buy X Get Y' };
const TYPE_OPTIONS = [
  { value: 'flat', label: TYPE_LABELS.flat },
  { value: 'product', label: TYPE_LABELS.product },
  { value: 'bogo', label: TYPE_LABELS.bogo },
];
const MODE_OPTIONS = [
  { value: 'percent', label: 'Percent (%)' },
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
    return {
      items: f.products.map((p) => ({
        product_id: p.id,
        discount_mode: f.discount_mode,
        discount_value: Number(f.discount_value) || 0,
      })),
    };
  }
  // bogo
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
    const it = (c.items || [])[0] || {};
    const n = (c.items || []).length;
    const each = it.discount_mode === 'percent' ? `${it.discount_value}%` : `₹${it.discount_value}`;
    return `${each} off · ${n} product${n === 1 ? '' : 's'}`;
  }
  if (offer.offer_type === 'bogo') {
    return `Buy ${c.buy_qty} Get ${c.get_qty} · ${(c.product_ids || []).length} product(s)`;
  }
  return '—';
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

const DashboardOffers = () => {
  const confirm = useConfirm();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  // Product search for the scope picker (server-paged, 20 at a time).
  const [productOpts, setProductOpts] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

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

  const searchProducts = async (term) => {
    setProductLoading(true);
    try {
      const resp = await getProductsPage(1, 20, term || '');
      const list = Array.isArray(resp) ? resp : (resp?.data || []);
      setProductOpts(list.map((p) => ({
        value: String(p.product_id || p.id),
        label: p.model_no || p.product_name || p.name || String(p.product_id || p.id),
      })));
    } catch {
      setProductOpts([]);
    } finally {
      setProductLoading(false);
    }
  };

  const addProduct = (value) => {
    if (!value) return;
    const opt = productOpts.find((o) => o.value === value);
    const label = opt ? opt.label : value;
    setForm((f) => f.products.some((p) => p.id === value)
      ? f
      : { ...f, products: [...f.products, { id: value, label }] });
  };
  const removeProduct = (id) => setForm((f) => ({ ...f, products: f.products.filter((p) => p.id !== id) }));

  const openAdd = () => { setForm(emptyForm()); setPanelOpen(true); };

  const openEdit = (offer) => {
    const c = offer.config || {};
    const isFlat = offer.offer_type === 'flat';
    const isProduct = offer.offer_type === 'product';
    const firstItem = (c.items || [])[0] || {};
    const products = isProduct
      ? (c.items || []).map((it) => ({ id: String(it.product_id), label: String(it.product_id) }))
      : (c.product_ids || []).map((id) => ({ id: String(id), label: String(id) }));
    setForm({
      offer_id: offer.offer_id,
      title: offer.title || '',
      offer_type: offer.offer_type || 'flat',
      is_active: offer.is_active !== false,
      priority: offer.priority || 0,
      start_date: offer.start_date ? new Date(offer.start_date).toISOString().split('T')[0] : '',
      end_date: offer.end_date ? new Date(offer.end_date).toISOString().split('T')[0] : '',
      discount_mode: isFlat ? (c.discount_mode || 'percent') : (firstItem.discount_mode || 'percent'),
      discount_value: isFlat ? (c.discount_value ?? '') : (firstItem.discount_value ?? ''),
      min_order_amount: c.min_order_amount ?? '',
      products,
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
      if (form.products.length === 0) return 'Select at least one product';
      if (!form.discount_value || Number(form.discount_value) <= 0) return 'Enter a discount value greater than 0';
    }
    if (form.offer_type === 'bogo') {
      if (form.products.length === 0) return 'Select at least one product';
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

  const handleDelete = async (offer) => {
    if (!(await confirm(`Delete offer "${offer.title}"?`))) return;
    setSaving(true);
    try {
      await deleteOffer(offer.offer_id);
      showSuccess('Offer deleted');
      await fetchOffers();
    } catch (err) {
      showError(err?.message || 'Failed to delete offer');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => ([
    { key: 'title', label: 'TITLE' },
    { key: 'offer_type', label: 'TYPE', render: (v) => TYPE_LABELS[v] || v },
    { key: 'discount', label: 'DISCOUNT', render: (_v, row) => summarise(row) },
    { key: 'validity', label: 'VALIDITY', render: (_v, row) => `${fmtDate(row.start_date)} → ${fmtDate(row.end_date)}` },
    { key: 'is_active', label: 'STATUS', render: (v) => (
      <StatusBadge status={v !== false ? 'active' : 'cancelled'}>{v !== false ? 'ACTIVE' : 'INACTIVE'}</StatusBadge>
    ) },
    { key: 'action', label: 'ACTIONS', render: (_v, row) => (
      <RowActions onEdit={() => openEdit(row)} onDelete={() => handleDelete(row)} />
    ) },
  ]), []);

  const showScope = form.offer_type === 'product' || form.offer_type === 'bogo';
  const showRate = form.offer_type === 'flat' || form.offer_type === 'product';

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        <div className="dash-row grid grid-cols-1 gap-3 min-[560px]:grid-cols-12 min-[560px]:gap-4">
          <div className="dash-card full col-span-full bg-surface border border-border rounded-lg shadow-sm p-0">
            {error && !loading ? (
              <div className="ui-state ui-state--error">
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
            ) : !loading && offers.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <p className="ui-state__title">No offers yet</p>
                <p className="ui-state__desc">Create a flat, product-wise or buy-X-get-Y offer for the cart.</p>
                <button className="ui-btn ui-btn--primary" onClick={openAdd}>Add Offer</button>
              </div>
            ) : (
              <TableWithControls
                title="Offers"
                columns={columns}
                rows={offers}
                selectable={!loading}
                onAddNew={openAdd}
                addNewText="Add Offer"
                onImport={fetchOffers}
                importText="Refresh"
                itemName="Offer"
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>

      <AsidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={form.offer_id ? 'Edit Offer' : 'Add Offer'}
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => setPanelOpen(false)} disabled={saving}>Cancel</button>
            <button className="ui-btn ui-btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : (form.offer_id ? 'Update' : 'Create')}
            </button>
          </>
        )}
      >
        <div className="ui-form">
          <div className="form-group form-group--full">
            <label className="ui-label">Title *</label>
            <input className="ui-input" placeholder="e.g. Diwali 10% off" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="form-group form-group--full">
            <label className="ui-label">Offer Type *</label>
            <DropdownSelector className="ui-dropdown-custom--full-width" options={TYPE_OPTIONS} value={form.offer_type} onChange={(v) => set('offer_type', v)} placeholder="Select type" />
          </div>

          {showRate && (
            <>
              <div className="form-group">
                <label className="ui-label">Discount Mode *</label>
                <DropdownSelector className="ui-dropdown-custom--full-width" options={MODE_OPTIONS} value={form.discount_mode} onChange={(v) => set('discount_mode', v)} placeholder="Mode" />
              </div>
              <div className="form-group">
                <label className="ui-label">Discount Value *</label>
                <input type="number" min="0" className="ui-input" placeholder={form.discount_mode === 'percent' ? 'e.g. 10' : 'e.g. 500'} value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} />
              </div>
            </>
          )}

          {form.offer_type === 'flat' && (
            <div className="form-group form-group--full">
              <label className="ui-label">Minimum Order Amount</label>
              <input type="number" min="0" className="ui-input" placeholder="Optional — e.g. 5000" value={form.min_order_amount} onChange={(e) => set('min_order_amount', e.target.value)} />
            </div>
          )}

          {form.offer_type === 'bogo' && (
            <>
              <div className="form-group">
                <label className="ui-label">Buy Qty *</label>
                <input type="number" min="1" className="ui-input" value={form.buy_qty} onChange={(e) => set('buy_qty', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="ui-label">Get Qty (free) *</label>
                <input type="number" min="1" className="ui-input" value={form.get_qty} onChange={(e) => set('get_qty', e.target.value)} />
              </div>
              <div className="form-group form-group--full">
                <label className="ui-label">Get Discount %</label>
                <input type="number" min="0" max="100" className="ui-input" placeholder="100 = free" value={form.get_discount_percent} onChange={(e) => set('get_discount_percent', e.target.value)} />
              </div>
            </>
          )}

          {showScope && (
            <div className="form-group form-group--full">
              <label className="ui-label">Products *</label>
              <DropdownSelector
                className="ui-dropdown-custom--full-width"
                options={productOpts}
                value=""
                onChange={addProduct}
                onOpen={() => { if (productOpts.length === 0) searchProducts(''); }}
                serverSearch
                onSearch={searchProducts}
                loading={productLoading}
                placeholder="Search & add products"
              />
              {form.products.length > 0 && (
                <div className="work-state-chips">
                  {form.products.map((p) => (
                    <span key={p.id} className="work-state-chip">
                      {p.label}
                      <button type="button" className="work-state-chip__remove" aria-label={`Remove ${p.label}`} onClick={() => removeProduct(p.id)}>
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="ui-label">Start Date</label>
            <input type="date" className="ui-input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="ui-label">End Date</label>
            <input type="date" className="ui-input" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="ui-label">Priority</label>
            <input type="number" className="ui-input" value={form.priority} onChange={(e) => set('priority', e.target.value)} />
          </div>
          <div className="form-group flex flex-row items-center gap-2">
            <input id="offer-active" type="checkbox" className="accent-primary cursor-pointer" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label htmlFor="offer-active" className="ui-label !mb-0 cursor-pointer">Active</label>
          </div>
        </div>
      </AsidePanel>
    </div>
  );
};

export default DashboardOffers;
