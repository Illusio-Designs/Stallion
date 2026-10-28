import { useEffect, useMemo, useRef, useState } from 'react';
import DropdownSelector from '../components/ui/DropdownSelector';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  addProductToTray,
  deleteProductFromTray,
  deleteTray,
  transferTrayProducts,
  getBrands,
  getCollections,
  getProductsPage,
  getProductsByIds,
  getProductsInTray,
  getTrayTasks,
  getTraysPage,
  updateProductInTray,
  updateTray,
} from '../services/apiService';
import { showError, showSuccess } from '../services/notificationService';
import { getUserRoles } from '../services/authService';
import { TASK_PILL } from '../utils/orderStatus';
import '../styles/pages/dashboard-orders.css';
import '../styles/pages/dashboard.css';
import '../styles/redesign-n-tray.css';
import '../styles/redesign-n-manage.css';
import '../styles/redesign-n-orders.css';
import GooeySearch from '../components/ui/GooeySearch';
import '../styles/redesign-p-forms.css';
import { FormSec, ChipRow } from '../components/forms/FormBits';

const TrayStatus = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  CLOSED: 'closed',
  INACTIVE: 'inactive'
};

const TrayProductStatus = {
  ALLOTED: 'alloted',
  PRIORITY_BOOKED: 'priority_booked',
  PARTIALLY_BOOKED: 'partially_booked',
  RETURNED: 'returned'
};

// Helper function to get status label
const getStatusLabel = (status) => {
  switch (status) {
    case TrayProductStatus.ALLOTED:
      return 'Alloted';
    case TrayProductStatus.PRIORITY_BOOKED:
      return 'Priority Booked';
    case TrayProductStatus.PARTIALLY_BOOKED:
      return 'Partially Booked';
    case TrayProductStatus.RETURNED:
      return 'Returned';
    default:
      return status || 'Alloted';
  }
};

// Helper function to get status colors
const getStatusColor = (status) => {
  switch (status) {
    case TrayProductStatus.ALLOTED:
      return { bg: '#ececec', text: '#0a0a0a' };
    case TrayProductStatus.PRIORITY_BOOKED:
      return { bg: '#0a0a0a', text: '#ffffff' };
    case TrayProductStatus.PARTIALLY_BOOKED:
      return { bg: '#f4f4f4', text: '#3b3b3b' };
    case TrayProductStatus.RETURNED:
      return { bg: '#fbe5e3', text: '#b3261e' };
    default:
      return { bg: '#f4f4f4', text: '#595959' };
  }
};

// Display-only helpers for the tray cards (use whatever the row carries).
const TRAY_SLOTS = 12;
const trayFrames = (t) => (Array.isArray(t.frames) ? t.frames : []);
const trayHolder = (t) => t.salesman_name || t.holder_name || t.assigned_to_name || t.salesman?.full_name || null;
const traySince = (t) => {
  const d = t.assigned_at || t.assigned_since || t.assigned_on;
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const trayState = (t) => {
  const st = String(t.tray_status || '').toLowerCase();
  if (st === TrayStatus.CLOSED) return 'closed';
  if (st === TrayStatus.INACTIVE) return 'inactive';
  const due = t.due_date || t.return_by;
  if (st === 'overdue' || t.is_overdue || t.overdue || (st === TrayStatus.ASSIGNED && due && new Date(due) < new Date())) return 'overdue';
  if (st === TrayStatus.ASSIGNED) return 'assigned';
  return 'available';
};
const TRAY_PILL = {
  available: ['ok', 'Available'],
  assigned: ['info', 'With a salesman'],
  overdue: ['bad', 'Overdue'],
  closed: ['idle', 'Closed'],
  inactive: ['idle', 'Inactive (salesman left)'],
};

const DashboardTray = () => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('all-trays');
  const [trayFilter, setTrayFilter] = useState('all');
  const [traySearch, setTraySearch] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [trays, setTrays] = useState([]);
  const [trayPage, setTrayPage] = useState(1);
  const [trayPageCount, setTrayPageCount] = useState(1);
  const [trayTotal, setTrayTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tray_name: '', tray_status: TrayStatus.AVAILABLE, is_active: true });
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState(null);

  // Product assignment tab state
  const [selectedTray, setSelectedTray] = useState('');
  const [trayProducts, setTrayProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  // Details of the products inside the open tray, fetched by id. (allProducts is only the first page
  // of the picker, so a product beyond it used to show as N/A.)
  const [trayProductMap, setTrayProductMap] = useState({});
  useEffect(() => {
    const ids = [...new Set((trayProducts || []).map((tp) => String(tp.product_id || tp.product?.product_id || tp.product?.id || '').toLowerCase()).filter(Boolean))]
      .filter((id) => !trayProductMap[id]);
    if (ids.length === 0) return undefined;
    let cancelled = false;
    getProductsByIds(ids)
      .then((list) => {
        if (cancelled) return;
        setTrayProductMap((prev) => {
          const next = { ...prev };
          (list || []).forEach((p) => { const id = String(p.product_id || p.id || '').toLowerCase(); if (id) next[id] = p; });
          return next;
        });
      })
      .catch(() => { /* the row keeps showing its id */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayProducts]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [brands, setBrands] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductStatus, setEditProductStatus] = useState(TrayProductStatus.ALLOTED);
  const [openEditProduct, setOpenEditProduct] = useState(false);

  // Server-paginated trays: 20 per page, fetched per page (and on search).
  const fetchTraysPage = async (page = 1, search = '', withInactive = showInactive) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTraysPage(page, 20, search, { activeOnly: !withInactive });
      const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      // A delete may have emptied the last page: step back to the last valid page.
      const lastPage = Math.max(1, res?.pagination?.totalPages ?? 1);
      if (data.length === 0 && page > lastPage) {
        return fetchTraysPage(lastPage, search, withInactive);
      }
      setTrays(data);
      setTrayPage(page);
      setTrayPageCount(Math.max(1, res?.pagination?.totalPages ?? 1));
      setTrayTotal(res?.pagination?.total ?? data.length);
    } catch (err) {
      setError(err.message || 'Failed to load trays');
      setTrays([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh the current page (used after add/update/delete).
  const fetchTrays = () => fetchTraysPage(trayPage, traySearch);

  // Assign-to-tray picker: 20 per page with server-side search (model_no/size).
  // Opening the picker / picking a tray loads page 1; typing re-queries the server.
  const fetchAllProducts = async (search = '') => {
    setLoadingProducts(true);
    try {
      const result = await getProductsPage(1, 20, search, { activeOnly: true });
      setAllProducts(Array.isArray(result) ? result : (result?.data || []));
    } catch (err) {
      console.error('Failed to load products:', err);
      setAllProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Debounced server search for the product picker.
  const productSearchTimer = useRef(null);
  const handleProductSearchChange = (term) => {
    setProductSearch(term);
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    productSearchTimer.current = setTimeout(() => fetchAllProducts(term), 300);
  };

  const fetchBrands = async () => {
    try {
      const data = await getBrands();
      setBrands(data || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
      setBrands([]);
    }
  };

  const fetchCollections = async () => {
    try {
      const data = await getCollections();
      setCollections(data || []);
    } catch (err) {
      console.error('Failed to load collections:', err);
      setCollections([]);
    }
  };

  useEffect(() => {
    // Only the trays are needed on load. Products/brands/collections are used
    // by the "assign-products" tab and are fetched on demand when it opens.
    fetchTrays();
  }, []);

  const resetForm = () => setForm({ tray_name: '', tray_status: TrayStatus.AVAILABLE, is_active: true });

  const handleSubmitNew = async () => {
    if (!form.tray_name.trim()) {
      setError('Tray name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Tray APIs have been removed
      setError('Tray APIs have been removed. Cannot create tray.');
    } catch (err) {
      setError(err.message || 'Failed to create tray');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      tray_name: row.tray_name || '',
      tray_status: row.tray_status || TrayStatus.AVAILABLE,
      is_active: row.is_active !== false,
    });
  };

  const handleUpdate = async () => {
    const trayId = editRow?.tray_id || editRow?.id;
    if (!trayId) return;
    if (!form.tray_name.trim()) {
      setError('Tray name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTray(trayId, {
        tray_name: form.tray_name.trim(),
        tray_status: form.tray_status,
        is_active: form.is_active !== false,
      });
      showSuccess('Tray updated successfully');
      await fetchTrays();
      setEditRow(null);
      resetForm();
    } catch (err) {
      const message = err.message || 'Failed to update tray';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const trayId = row?.tray_id || row?.id;
    if (!trayId) return;
    const confirmed = await confirm(`Delete tray "${row.tray_name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTray(trayId);
      showSuccess('Tray deleted successfully');
      await fetchTrays();
    } catch (err) {
      const message = err.message || 'Failed to delete tray';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTrayChange = async (trayId) => {
    setSelectedTray(trayId);
    if (!trayId) {
      setTrayProducts([]);
      return;
    }
    setError(null);
    setLoadingProducts(true);
    try {
      // Ensure products, brands, and collections are loaded before fetching tray products
      if (allProducts.length === 0) {
        await fetchAllProducts();
      }
      if (brands.length === 0) {
        await fetchBrands();
      }
      if (collections.length === 0) {
        await fetchCollections();
      }
      const items = await getProductsInTray(trayId);
      setTrayProducts(Array.isArray(items) ? items : []);
    } catch (err) {
      const message = err.message || 'Failed to fetch tray products';
      setError(message);
      showError(message);
      setTrayProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedTray) {
      setError('Please select a tray');
      return;
    }
    if (!selectedProducts || selectedProducts.length === 0) {
      setError('Please select at least one product');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Add all selected products to the tray
      const addPromises = selectedProducts.map(productId =>
        addProductToTray({
          tray_id: selectedTray,
          product_id: productId,
          qty: 1,
          status: TrayProductStatus.ALLOTED,
        })
      );

      await Promise.all(addPromises);
      showSuccess(`${selectedProducts.length} product(s) added to tray successfully`);
      const items = await getProductsInTray(selectedTray);
      setTrayProducts(Array.isArray(items) ? items : []);
      await fetchTrays(); // Refresh tray list to update product count
      setSelectedProducts([]);
      setProductDropdownOpen(false);
      setProductSearch('');
    } catch (err) {
      const message = err.message || 'Failed to add products to tray';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProductStatus = async (trayProduct) => {
    if (!trayProduct?.product_id || !selectedTray) return;
    if (!editProductStatus) {
      setError('Status is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProductInTray({
        tray_id: selectedTray,
        product_id: trayProduct.product_id,
        qty: 1,
        status: editProductStatus,
      });
      showSuccess('Product status updated successfully');
      const items = await getProductsInTray(selectedTray);
      setTrayProducts(Array.isArray(items) ? items : []);
      setEditingProduct(null);
      setEditProductStatus(TrayProductStatus.ALLOTED);
      setOpenEditProduct(false);
      await fetchTrays(); // Refresh tray list
    } catch (err) {
      const message = err.message || 'Failed to update product status';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProduct = async (trayProduct) => {
    if (!trayProduct?.product_id || !selectedTray) return;
    const confirmed = await confirm(`Remove product from tray?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProductFromTray({
        tray_id: selectedTray,
        product_id: trayProduct.product_id,
      });
      showSuccess('Product removed from tray successfully');
      const items = await getProductsInTray(selectedTray);
      setTrayProducts(Array.isArray(items) ? items : []);
      await fetchTrays(); // Refresh tray list
    } catch (err) {
      const message = err.message || 'Failed to remove product from tray';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  // Move a piece to the warehouse or into another tray (toTrayId '' = warehouse).
  const handleMoveProduct = async (trayProduct, toTrayId) => {
    if (!trayProduct?.product_id || !selectedTray || toTrayId === undefined || toTrayId === null) return;
    const target = toTrayId === '' ? 'the warehouse' : 'the selected tray';
    const confirmed = await confirm(`Move this piece to ${target}?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await transferTrayProducts([{
        from_tray_id: selectedTray,
        product_id: trayProduct.product_id,
        ...(toTrayId ? { to_tray_id: toTrayId } : {}),
      }]);
      showSuccess(toTrayId ? 'Moved to the other tray' : 'Moved back to the warehouse');
      const items = await getProductsInTray(selectedTray);
      setTrayProducts(Array.isArray(items) ? items : []);
      await fetchTrays();
    } catch (err) {
      const message = err.message || 'Failed to move the piece';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  // Tray cards: pick frames in a card (by slot), then "Take back" returns them to the warehouse
  // (same transfer API as the Assign Products tab). With nothing picked it takes back every frame.
  const [cardPick, setCardPick] = useState({}); // { [trayId]: [product_id] }
  const [cardBusy, setCardBusy] = useState('');

  // Return tasks: frames booked from trays for orders that must come back to the office.
  // Shown to admin and tray manager only (the salesman sees their own on the home page).
  // A salesman sees the trays that are with him and cannot add, edit or move anything.
  const readOnly = useMemo(() => {
    const roles = getUserRoles();
    return roles.includes('salesman') && !roles.some((r) => ['admin', 'tray_manager', 'sales_manager'].includes(r));
  }, []);
  const canSeeReturnTasks = useMemo(() => getUserRoles().some((r) => ['admin', 'tray_manager'].includes(r)), []);
  const [returnTasks, setReturnTasks] = useState([]);
  useEffect(() => {
    if (!canSeeReturnTasks) return undefined;
    let alive = true;
    getTrayTasks('open')
      .then((list) => { if (alive) setReturnTasks(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setReturnTasks([]); });
    return () => { alive = false; };
  }, [canSeeReturnTasks]);
  // Pieces booked for orders per tray (not yet sent back).
  const bookedByTray = useMemo(() => {
    const out = {};
    returnTasks.forEach((t) => {
      if (t.status === 'booked' && t.tray_id) out[t.tray_id] = (out[t.tray_id] || 0) + (Number(t.qty) || 0);
    });
    return out;
  }, [returnTasks]);
  const toggleCardPick = (trayId, productId) => {
    setCardPick((prev) => {
      const cur = prev[trayId] || [];
      return { ...prev, [trayId]: cur.includes(productId) ? cur.filter((id) => id !== productId) : [...cur, productId] };
    });
  };
  const handleAssignFrame = (tray) => {
    const trayId = tray.tray_id || tray.id;
    if (!trayId) return;
    setActiveTab('assign-products');
    handleTrayChange(trayId);
  };
  const handleTakeBack = async (tray) => {
    const trayId = tray.tray_id || tray.id;
    const frames = trayFrames(tray);
    if (!trayId || frames.length === 0) return;
    const picked = cardPick[trayId] || [];
    const list = picked.length ? frames.filter((f) => picked.includes(f.product_id)) : frames;
    const confirmed = await confirm(`Take ${list.length} ${list.length === 1 ? 'frame' : 'frames'} back from "${tray.tray_name}" to the warehouse?`);
    if (!confirmed) return;
    setCardBusy(trayId);
    setError(null);
    try {
      await transferTrayProducts(list.map((f) => ({ from_tray_id: trayId, product_id: f.product_id })));
      showSuccess('Taken back to the warehouse');
      setCardPick((prev) => ({ ...prev, [trayId]: [] }));
      await fetchTrays();
    } catch (err) {
      showError(err.message || 'Failed to take the frames back');
    } finally {
      setCardBusy('');
    }
  };

  const startEditProduct = (trayProduct) => {
    setEditingProduct(trayProduct);
    setEditProductStatus(trayProduct.status || TrayProductStatus.ALLOTED);
    setOpenEditProduct(true);
  };

  const cancelEditProduct = () => {
    setEditingProduct(null);
    setEditProductStatus(TrayProductStatus.ALLOTED);
    setOpenEditProduct(false);
  };

  const trayChips = useMemo(() => {
    const counts = { all: trays.length, available: 0, assigned: 0, overdue: 0, closed: 0 };
    trays.forEach((t) => { counts[trayState(t)] += 1; });
    const chips = [
      { key: 'all', label: 'All', count: counts.all },
      { key: 'available', label: 'Available', count: counts.available },
      { key: 'assigned', label: 'With a salesman', count: counts.assigned },
      { key: 'overdue', label: 'Overdue', count: counts.overdue },
    ];
    if (counts.closed > 0) chips.push({ key: 'closed', label: 'Closed', count: counts.closed });
    return chips;
  }, [trays]);
  const visibleTrays = useMemo(
    () => (trayFilter === 'all' ? trays : trays.filter((t) => trayState(t) === trayFilter)),
    [trays, trayFilter],
  );
  const traySearchTimer = useRef(null);
  const handleTraySearch = (term) => {
    setTraySearch(term);
    if (traySearchTimer.current) clearTimeout(traySearchTimer.current);
    traySearchTimer.current = setTimeout(() => fetchTraysPage(1, term), 350);
  };

  // Reset selected tray when switching tabs
  useEffect(() => {
    if (activeTab !== 'assign-products') {
      // Products/brands/collections are NOT pre-loaded here: they're fetched on
      // demand by handleSelectTray once the user actually picks a tray, so the
      // tab opens without firing several list calls at once.
      // Reset state when switching away from assign products tab
      setSelectedTray('');
      setTrayProducts([]);
      setSelectedProducts([]);
      setProductDropdownOpen(false);
      setEditingProduct(null);
      setEditProductStatus(TrayProductStatus.ALLOTED);
    }
  }, [activeTab]);

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-[var(--space-4)]">
        <div className="page-head tray-head">
          <div>
            <h1>Sample trays</h1>
            <p>{readOnly ? 'The trays that are with you. The office gives and takes them back.' : 'Admin and tray managers manage trays. Sales managers can assign them to salesmen.'}</p>
          </div>
          {activeTab === 'all-trays' && (
            <div className="page-head__actions">
              <button className="ui-btn ui-btn--secondary" onClick={fetchTrays} disabled={loading}>Refresh</button>
              {!readOnly && <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Tray</button>}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        {!readOnly && (<div className="dash-row grid grid-cols-12 gap-[var(--space-4)] max-[560px]:grid-cols-1 max-[560px]:gap-[var(--space-3)]">
          <div className="order-tabs-container col-span-full flex w-full gap-[var(--space-2)] overflow-x-auto rounded-lg border border-border bg-surface px-[var(--space-3)] py-[var(--space-2)] shadow-sm">
            <button
              className={`order-tab inline-flex min-h-[40px] flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-base)] font-semibold leading-snug transition-colors active:scale-[0.98] ${activeTab === 'all-trays' ? 'active bg-primary text-white' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
              onClick={() => setActiveTab('all-trays')}
            >
              All Trays
            </button>
            <button
              className={`order-tab inline-flex min-h-[40px] flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-base)] font-semibold leading-snug transition-colors active:scale-[0.98] ${activeTab === 'assign-products' ? 'active bg-primary text-white' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
              onClick={() => setActiveTab('assign-products')}
            >
              Assign Products
            </button>
          </div>
        </div>)}

        {/* Tab Content */}
        {activeTab === 'all-trays' && (
          <div className="tray-view">
            {canSeeReturnTasks && returnTasks.length > 0 && (
              <section className="ordn-tasks" aria-label="Return tasks">
                <h5 className="ord-view__section-title">Return tasks <span className="tray-meta">({returnTasks.length})</span></h5>
                {returnTasks.map((t) => (
                  <div className="ordn-task" key={t.task_id}>
                    <div className="ordn-task__head">
                      <b className="min-w-0 break-words">{[t.tray_name, t.salesman_name].filter(Boolean).join(' · ') || 'Tray'}</b>
                      <span className={`ordn-pill ordn-pill--${t.status}`}>{TASK_PILL[t.status] || t.status}</span>
                    </div>
                    <div className="ordn-task__meta">{Number(t.qty) || 0} pieces{t.order_number ? ` · Order ${t.order_number}` : ''}</div>
                  </div>
                ))}
              </section>
            )}
            <div className="tray-toolbar">
              <div className="chips" role="tablist" aria-label="Filter trays">
                {trayChips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={trayFilter === c.key}
                    className={`chip${trayFilter === c.key ? ' on' : ''}`}
                    onClick={() => setTrayFilter(c.key)}
                  >
                    {c.label} <b>{c.count}</b>
                  </button>
                ))}
                {!readOnly && <button
                  type="button"
                  aria-pressed={showInactive}
                  className={`chip${showInactive ? ' on' : ''}`}
                  onClick={() => { const next = !showInactive; setShowInactive(next); fetchTraysPage(1, traySearch, next); }}
                >
                  Show inactive
                </button>}
              </div>
              <GooeySearch
                value={traySearch}
                onChange={handleTraySearch}
                placeholder="Search trays"
                label="Search trays"
                openWidth={260}
                rowOnPhone
              />
            </div>

            {error && !loading ? (
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn't load trays</p>
                <p className="ui-state__desc">{error}</p>
                <button className="ui-btn ui-btn--secondary" onClick={fetchTrays}>Try again</button>
              </div>
            ) : loading && trays.length === 0 ? (
              <div className="tray-grid" aria-busy="true">
                {[0, 1, 2].map((i) => <div key={i} className="tray-card ui-skeleton" style={{ height: 190 }} />)}
              </div>
            ) : visibleTrays.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <p className="ui-state__title">{trays.length === 0 ? 'No trays yet' : 'No trays in this view'}</p>
                <p className="ui-state__desc">{trays.length === 0 ? (readOnly ? 'The office has not given you a tray yet.' : 'Add a tray to start grouping sample frames.') : 'Try another filter.'}</p>
                {trays.length === 0 && !readOnly && <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Tray</button>}
              </div>
            ) : (
              <div className="tray-grid">
                {visibleTrays.map((t) => {
                  const state = trayState(t);
                  const [pillCls, pillLabel] = TRAY_PILL[state];
                  const holder = trayHolder(t);
                  const since = traySince(t);
                  const trayId = t.tray_id || t.id;
                  const frames = trayFrames(t);
                  const picked = cardPick[trayId] || [];
                  const shown = frames.slice(0, TRAY_SLOTS);
                  const busy = cardBusy === trayId;
                  const trayOff = t.is_active === false;
                  const canAssign = !trayOff && (state === 'available' || state === 'assigned' || state === 'overdue');
                  return (
                    <div key={trayId || t.tray_name} className="tray-card trn-card">
                      <div className="tray-card__top">
                        <div className="trn-title">
                          <h3>{t.tray_name || 'Untitled tray'}</h3>
                          <span className={`trn-who${holder ? '' : ' trn-who--none'}`}>
                            {holder ? `${holder}${since ? ` · since ${since}` : ''}` : 'Not assigned'}
                          </span>
                        </div>
                        <span className="tray-card__pills">
                          {trayOff && <span className="pill idle">Inactive</span>}
                          <span className={`pill ${pillCls}`}>{pillLabel}</span>
                        </span>
                      </div>
                      {(bookedByTray[trayId] || 0) > 0 && <span className="tray-meta">{bookedByTray[trayId]} booked for orders</span>}
                      <div className="trn-fill">
                        <span className="trn-fill__pill">{frames.length} of {TRAY_SLOTS}</span>
                        {frames.length > TRAY_SLOTS && <span className="trn-fill__more">+{frames.length - TRAY_SLOTS} more{readOnly ? "" : " in Assign Products"}</span>}
                      </div>
                      <div className="trn-slots" role="group" aria-label={`Frames in ${t.tray_name}`}>
                        {Array.from({ length: TRAY_SLOTS }).map((_, i) => {
                          const f = shown[i];
                          if (!f) return <span key={i} className="trn-slot trn-slot--empty" aria-hidden="true" />;
                          const on = picked.includes(f.product_id);
                          return (
                            <button
                              key={f.product_id}
                              type="button"
                              className={`trn-slot trn-slot--full${on ? ' on' : ''}`}
                              aria-pressed={on}
                              title={`${f.model_no || 'Frame'}${f.qty > 1 ? ` x${f.qty}` : ''} (${getStatusLabel(f.status)})`}
                              disabled={readOnly}
                              onClick={() => toggleCardPick(trayId, f.product_id)}
                            >
                              {String(f.model_no || '?').slice(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                      {frames.length === 0 && <span className="tray-meta">No frames yet.</span>}
                      {!readOnly && <div className="tray-card__actions trn-actions">
                        <button type="button" className="ui-btn ui-btn--primary" onClick={() => handleAssignFrame(t)} disabled={!canAssign || saving || busy}>Assign frame</button>
                        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => handleTakeBack(t)} disabled={frames.length === 0 || saving || busy}>
                          {busy ? 'Taking back…' : picked.length ? `Take back (${picked.length})` : 'Take back'}
                        </button>
                        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => openEdit(t)}>Edit</button>
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}

            {trayPageCount > 1 && (
              <div className="tray-pager">
                <button className="ui-btn ui-btn--secondary" disabled={loading || trayPage <= 1} onClick={() => fetchTraysPage(trayPage - 1, traySearch)}>Previous</button>
                <span>Page {trayPage} of {trayPageCount} · {trayTotal} trays</span>
                <button className="ui-btn ui-btn--secondary" disabled={loading || trayPage >= trayPageCount} onClick={() => fetchTraysPage(trayPage + 1, traySearch)}>Next</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assign-products' && (
          <div className="dash-row grid grid-cols-12 gap-[var(--space-4)] max-[560px]:grid-cols-1 max-[560px]:gap-[var(--space-3)]">
            <div className="dash-card full col-span-full rounded-lg border border-border bg-surface p-0 shadow-sm">
              <div className="p-3 sm:p-5">
                <h2 className="mt-0 mb-5">Assign Products to Sample</h2>

                {error && <div className="mb-3 rounded-lg border border-[#fcc] bg-[#fee] p-3 text-[#b00020]">{error}</div>}

                {/* Single Section: Tray Selection, Add Product, and Products Table */}
                <div className="flex flex-col gap-6">
                  {/* Tray Selection */}
                  <div className="form-group">
                    <label className="ui-label" style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 700 }}>Select Sample</label>
                    <DropdownSelector
                      options={trays.filter((t) => t.is_active !== false).map(t => ({
                        value: t.tray_id || t.id,
                        label: t.tray_name || 'N/A'
                      }))}
                      value={selectedTray}
                      onChange={handleTrayChange}
                      placeholder="Select a tray"
                    />
                  </div>

                  {/* Add Product Section - Only show when tray is selected */}
                  {selectedTray && (
                    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 sm:p-6">
                      <h3 className="mb-5 mt-0 text-[18px] font-bold text-[#000000]">
                        Add Products to Tray
                      </h3>
                      <div className="flex flex-col gap-4">
                        <div className="form-group" style={{ position: 'relative' }}>
                          <label className="ui-label" style={{ marginBottom: '8px' }}>Select Products</label>
                          <div className="relative">
                            {/* Trigger button */}
                            <button
                              type="button"
                              onClick={() => { setProductDropdownOpen(!productDropdownOpen); if (productDropdownOpen) setProductSearch(''); }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: `1px solid ${productDropdownOpen ? '#16171d' : '#e5e7eb'}`,
                                borderRadius: '8px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                color: selectedProducts.length === 0 ? '#999' : '#333'
                              }}
                            >
                              <span>
                                {selectedProducts.length === 0
                                  ? 'Select products to add'
                                  : `${selectedProducts.length} product(s) selected`}
                              </span>
                              <span className="text-[12px] text-[#666]">
                                {productDropdownOpen ? '▲' : '▼'}
                              </span>
                            </button>

                            {productDropdownOpen && (
                              <>
                                {/* Dropdown panel */}
                                <div
                                  className="absolute left-0 right-0 top-full z-[1001] mt-1 flex h-[270px] flex-col rounded-[10px] border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                                >
                                  {/* Search bar — sticky top */}
                                  <div className="shrink-0 border-b border-[#f0f0f0] p-[10px]">
                                    <input
                                      type="text"
                                      placeholder="🔍  Search by model, brand or collection..."
                                      value={productSearch}
                                      onChange={(e) => handleProductSearchChange(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      className="box-border w-full rounded-md border border-[#e5e7eb] bg-[#f9fafb] p-[8px_10px] text-[13px] outline-none"
                                    />
                                  </div>

                                  {/* Product list — scrollable */}
                                  <div className="flex-1 overflow-y-auto p-[6px]">
                                    {loadingProducts ? (
                                      <div className="p-5 text-center text-[13px] text-[#999]">
                                        Loading…
                                      </div>
                                    ) : allProducts.length === 0 ? (
                                      <div className="p-5 text-center text-[13px] text-[#999]">
                                        {productSearch.trim() ? `No products match "${productSearch}"` : 'No products available'}
                                      </div>
                                    ) : (() => {
                                      return allProducts.map((p) => {
                                        const productId = p.id || p.product_id;
                                        const productIdStr = String(productId);
                                        const isSelected = selectedProducts.includes(productIdStr);
                                        return (
                                          <label
                                            key={productId}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              padding: '9px 10px',
                                              borderRadius: '6px',
                                              cursor: 'pointer',
                                              backgroundColor: isSelected ? '#f3f4f5' : 'transparent',
                                              borderLeft: isSelected ? '3px solid #16171d' : '3px solid transparent',
                                              marginBottom: '2px',
                                              transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f3f4f5' : 'transparent'; }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedProducts(prev => [...prev, productIdStr]);
                                                } else {
                                                  setSelectedProducts(prev => prev.filter(id => id !== productIdStr));
                                                }
                                              }}
                                              className="mr-[10px] h-4 w-4 shrink-0 cursor-pointer accent-[#16171d]"
                                            />
                                            <span className="text-[13px] leading-[1.4] text-[#333]">
                                              <strong className="text-[#111]">{p.model_no || 'N/A'}</strong>
                                              {(p.brand_name || p.collection_name) && (
                                                <span className="ml-[6px] text-[#5c5c5c]">
                                                  {[p.brand_name, p.collection_name].filter(Boolean).join(' · ')}
                                                </span>
                                              )}
                                            </span>
                                          </label>
                                        );
                                      });
                                    })()}
                                  </div>

                                  {/* Footer with actions — sticky bottom */}
                                  <div className="flex shrink-0 items-center justify-between rounded-b-[10px] border-t border-[#f0f0f0] bg-[#fafafa] p-[10px_12px]">
                                    <span className="text-[12px] text-[#5c5c5c]">
                                      {selectedProducts.length > 0 ? `${selectedProducts.length} selected` : 'None selected'}
                                    </span>
                                    <div className="flex gap-2">
                                      {selectedProducts.length > 0 && (
                                        <button
                                          type="button"
                                          className="ui-btn ui-btn--secondary"
                                          onClick={(e) => { e.stopPropagation(); setSelectedProducts([]); }}
                                          style={{ padding: '6px 14px', fontSize: '13px' }}
                                        >
                                          Clear
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="ui-btn ui-btn--primary"
                                        disabled={saving || selectedProducts.length === 0}
                                        onClick={(e) => { e.stopPropagation(); handleAddProduct(); }}
                                        style={{ padding: '6px 16px', fontSize: '13px' }}
                                      >
                                        {saving ? 'Adding...' : `Add ${selectedProducts.length > 0 ? selectedProducts.length : ''} Product${selectedProducts.length !== 1 ? 's' : ''}`}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                {/* Backdrop — rendered after panel so panel stays on top */}
                                <div
                                  className="fixed inset-0 z-[999]"
                                  onClick={() => { setProductDropdownOpen(false); setProductSearch(''); }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Products List - Always visible */}
                  <div>
                    <h3 className="mb-[15px] mt-0">
                      Products in Sample ({trayProducts.length})
                    </h3>
                    <div className="tray-assign-table max-h-[500px] overflow-x-auto overflow-y-auto rounded-lg border border-[#e5e7eb]">
                      <table className="w-full min-w-[720px] border-collapse">
                        <thead>
                          <tr className="sticky top-0 bg-[#f0f0f0]">
                            <th className="border-b-2 border-[#ddd] p-3 text-left">MODEL NO</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">BRAND</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">COLLECTION</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">MRP</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">WHP</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">QUANTITY</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">STATUS</th>
                            <th className="border-b-2 border-[#ddd] p-3 text-left">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingProducts ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <tr key={`sk-${i}`} className="border-b border-[#eee]">
                                {Array.from({ length: 8 }).map((__, c) => (
                                  <td key={c} className="p-3">
                                    <span className="ui-skeleton" style={{ display: 'block', height: '14px', width: c === 7 ? '60px' : '100%', borderRadius: '6px' }} />
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : error && selectedTray ? (
                            <tr>
                              <td colSpan="8" className="p-0">
                                <div className="ui-state ui-state--error">
                                  <div className="ui-state__icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="12" y1="8" x2="12" y2="12" />
                                      <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                  </div>
                                  <p className="ui-state__title">Couldn't load products</p>
                                  <p className="ui-state__desc">{error}</p>
                                  <button className="ui-btn ui-btn--secondary" onClick={() => handleTrayChange(selectedTray)}>Try again</button>
                                </div>
                              </td>
                            </tr>
                          ) : trayProducts.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="p-0">
                                <div className="ui-state ui-state--empty">
                                  <div className="ui-state__icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <rect x="3" y="7" width="18" height="13" rx="2" />
                                      <path d="M3 11h18" />
                                      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </div>
                                  <p className="ui-state__title">{selectedTray ? 'No products yet' : 'No tray selected'}</p>
                                  <p className="ui-state__desc">
                                    {selectedTray
                                      ? 'This tray has no products. Use "Add Products to Tray" above to assign some.'
                                      : 'Select a tray above to view and manage its products.'}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            trayProducts.map((tp) => {
                              // Match product by product_id - try both id and product_id fields
                              const productId = tp.product_id || tp.product?.product_id || tp.product?.id;
                              const product = trayProductMap[String(productId || '').toLowerCase()] || allProducts.find(p => {
                                const pId = p.product_id || p.id;
                                return pId && productId && String(pId).toLowerCase() === String(productId).toLowerCase();
                              });

                              // If product not found, try to get brand and collection from nested product object
                              const productData = product || tp.product;
                              const brandId = productData?.brand_id;
                              const collectionId = productData?.collection_id;

                              const brand = brandId ? brands.find(b => {
                                const bId = b.brand_id || b.id;
                                return bId && String(bId).toLowerCase() === String(brandId).toLowerCase();
                              }) : null;

                              const collection = collectionId ? collections.find(c => {
                                const cId = c.collection_id || c.id;
                                return cId && String(cId).toLowerCase() === String(collectionId).toLowerCase();
                              }) : null;

                              return (
                                <tr key={tp.id} className="border-b border-[#eee]">
                                  <td className="p-3">
                                    {productData?.model_no || 'N/A'}
                                    {!product && productId && (
                                      <span className="block text-[10px] text-[#999]">
                                        (ID: {productId.substring(0, 8)}...)
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {brand?.brand_name || productData?.brand_name || 'N/A'}
                                  </td>
                                  <td className="p-3">
                                    {collection?.collection_name || productData?.collection_name || 'N/A'}
                                  </td>
                                  <td className="p-3">
                                    {productData?.mrp ? `₹${parseFloat(productData.mrp || 0).toLocaleString('en-IN')}` : 'N/A'}
                                  </td>
                                  <td className="p-3">
                                    {productData?.whp ? `₹${parseFloat(productData.whp || 0).toLocaleString('en-IN')}` : 'N/A'}
                                  </td>
                                  <td className="p-3">
                                    1
                                  </td>
                                  <td className="p-3">
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      backgroundColor: getStatusColor(tp.status || TrayProductStatus.ALLOTED).bg,
                                      color: getStatusColor(tp.status || TrayProductStatus.ALLOTED).text
                                    }}>
                                      {getStatusLabel(tp.status || TrayProductStatus.ALLOTED)}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <DropdownSelector
                                        options={[
                                          { value: '__warehouse', label: 'Warehouse' },
                                          ...trays
                                            .filter((t) => (t.tray_id || t.id) !== selectedTray && t.tray_status !== 'inactive' && t.is_active !== false)
                                            .map((t) => ({ value: t.tray_id || t.id, label: t.tray_name || t.name })),
                                        ]}
                                        value=""
                                        placeholder="Move to…"
                                        disabled={saving}
                                        onChange={(v) => handleMoveProduct(tp, v === '__warehouse' ? '' : v)}
                                      />
                                      <RowActions
                                        onEdit={() => startEditProduct(tp)}
                                        onDelete={() => handleRemoveProduct(tp)}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <AsidePanel
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        title="Add tray"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { resetForm(); setOpenAdd(false); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleSubmitNew}>Save tray</button>
          </>
        )}
      >
        <div className="ui-form rf-form">
          <FormSec title="Tray" className="rf-sec--one">
          <div className="form-group">
            <label className="ui-label">Tray name</label>
            <input
              className="ui-input"
              placeholder="Tray 7"
              value={form.tray_name}
              onChange={(e) => setForm((p) => ({ ...p, tray_name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Status</label>
            <ChipRow
              label="Tray status"
              options={[
                { value: TrayStatus.AVAILABLE, label: 'Available' },
                { value: TrayStatus.ASSIGNED, label: 'Assigned' },
                { value: TrayStatus.CLOSED, label: 'Closed' }
              ]}
              value={form.tray_status}
              onChange={(value) => setForm((p) => ({ ...p, tray_status: value }))}
            />
          </div>
          </FormSec>
        </div>
      </AsidePanel>
      <AsidePanel
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit tray"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setEditRow(null); resetForm(); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleUpdate}>Update tray</button>
          </>
        )}
      >
        <div className="ui-form rf-form">
          <FormSec title="Tray" className="rf-sec--one">
          <div className="form-group">
            <label className="ui-label">Tray name</label>
            <input
              className="ui-input"
              value={form.tray_name}
              onChange={(e) => setForm((p) => ({ ...p, tray_name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Status</label>
            <ChipRow
              label="Tray status"
              options={[
                { value: TrayStatus.AVAILABLE, label: 'Available' },
                { value: TrayStatus.ASSIGNED, label: 'Assigned' },
                { value: TrayStatus.CLOSED, label: 'Closed' }
              ]}
              value={form.tray_status}
              onChange={(value) => setForm((p) => ({ ...p, tray_status: value }))}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Active</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active !== false}
              onClick={() => setForm((p) => ({ ...p, is_active: p.is_active === false }))}
              className="mng-switch"
            >
              <span className={`mng-switch__track ${form.is_active !== false ? 'is-on' : ''}`}>
                <span className="mng-switch__dot" />
              </span>
              <span className="mng-switch__label">{form.is_active !== false ? 'Active' : 'Inactive'}</span>
            </button>
            <p className="mng-note">Inactive items are hidden from forms. Nothing is ever deleted. A tray can only be switched off when it is empty.</p>
          </div>
          </FormSec>
        </div>
      </AsidePanel>

      {/* Edit Product Status Modal */}
      <AsidePanel
        open={openEditProduct}
        onClose={cancelEditProduct}
        title="Edit Product Status"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={cancelEditProduct}>Cancel</button>
            <button
              className="ui-btn ui-btn--primary"
              disabled={saving}
              onClick={() => editingProduct && handleUpdateProductStatus(editingProduct)}
            >
              Update
            </button>
          </>
        )}
      >
        <div className="ui-form">
          {editingProduct && (() => {
            const productId = editingProduct.product_id || editingProduct.product?.product_id || editingProduct.product?.id;
            const product = trayProductMap[String(productId || '').toLowerCase()] || allProducts.find(p => {
              const pId = p.product_id || p.id;
              return pId && productId && String(pId).toLowerCase() === String(productId).toLowerCase();
            });
            const productData = product || editingProduct.product;
            return (
              <>
                <div className="form-group">
                  <label className="ui-label">Model No</label>
                  <input
                    className="ui-input"
                    value={productData?.model_no || 'N/A'}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="ui-label">Status</label>
                  <DropdownSelector
                    options={[
                      { value: TrayProductStatus.ALLOTED, label: 'Alloted' },
                      { value: TrayProductStatus.PRIORITY_BOOKED, label: 'Priority Booked' },
                      { value: TrayProductStatus.PARTIALLY_BOOKED, label: 'Partially Booked' },
                      { value: TrayProductStatus.RETURNED, label: 'Returned' }
                    ]}
                    value={editProductStatus}
                    onChange={(value) => setEditProductStatus(value)}
                    placeholder="Select status"
                  />
                </div>
              </>
            );
          })()}
        </div>
      </AsidePanel>

    </div>
  );
};

export default DashboardTray;
