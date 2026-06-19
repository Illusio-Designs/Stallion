import { useEffect, useMemo, useRef, useState } from 'react';
import DropdownSelector from '../components/ui/DropdownSelector';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import TableWithControls from '../components/ui/TableWithControls';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  addProductToTray,
  deleteProductFromTray,
  deleteTray,
  getBrands,
  getCollections,
  getProductsPage,
  getProductsInTray,
  getTraysPage,
  updateProductInTray,
  updateTray,
} from '../services/apiService';
import { showError, showSuccess } from '../services/notificationService';
import '../styles/pages/dashboard-orders.css';
import '../styles/pages/dashboard.css';

const TrayStatus = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  CLOSED: 'closed'
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
      return { bg: '#e3f2fd', text: '#1976d2' };
    case TrayProductStatus.PRIORITY_BOOKED:
      return { bg: '#fff3e0', text: '#e65100' };
    case TrayProductStatus.PARTIALLY_BOOKED:
      return { bg: '#f3e5f5', text: '#6a1b9a' };
    case TrayProductStatus.RETURNED:
      return { bg: '#ffebee', text: '#c62828' };
    default:
      return { bg: '#f5f5f5', text: '#666' };
  }
};

const DashboardTray = () => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('all-trays');
  const [dateRange, setDateRange] = useState('Feb 25, 2025 - Mar 25, 2025');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [trays, setTrays] = useState([]);
  const [trayPage, setTrayPage] = useState(1);
  const [trayPageCount, setTrayPageCount] = useState(1);
  const [trayTotal, setTrayTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tray_name: '', tray_status: TrayStatus.AVAILABLE });
  const [error, setError] = useState(null);

  // Product assignment tab state
  const [selectedTray, setSelectedTray] = useState('');
  const [trayProducts, setTrayProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [brands, setBrands] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductStatus, setEditProductStatus] = useState(TrayProductStatus.ALLOTED);
  const [openEditProduct, setOpenEditProduct] = useState(false);

  const columns = useMemo(() => ([
    { key: 'tray_name', label: 'TRAY NAME' },
    {
      key: 'tray_status',
      label: 'STATUS',
      render: (_v, row) => {
        const status = row.tray_status || '';
        if (status === TrayStatus.AVAILABLE) return 'AVAILABLE';
        if (status === TrayStatus.ASSIGNED) return 'ASSIGNED';
        if (status === TrayStatus.CLOSED) return 'CLOSED';
        return status.toUpperCase();
      }
    },
    {
      key: 'action',
      label: 'ACTIONS',
      render: (_v, row) => (
        <RowActions
          onEdit={() => openEdit(row)}
          onDownload={null}
          onDelete={() => handleDelete(row)}
        />
      ),
    },
  ]), []);

  // Server-paginated trays: 20 per page, fetched per page (and on search).
  const fetchTraysPage = async (page = 1, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTraysPage(page, 20, search);
      const data = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
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
  const fetchTrays = () => fetchTraysPage(trayPage);

  // Assign-to-tray picker: 20 per page with server-side search (model_no/size).
  // Opening the picker / picking a tray loads page 1; typing re-queries the server.
  const fetchAllProducts = async (search = '') => {
    setLoadingProducts(true);
    try {
      const result = await getProductsPage(1, 20, search);
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

  const resetForm = () => setForm({ tray_name: '', tray_status: TrayStatus.AVAILABLE });

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

  const rows = useMemo(() => trays, [trays]);

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
        {/* Tab Navigation */}
        <div className="dash-row grid grid-cols-12 gap-[var(--space-4)] max-[560px]:grid-cols-1 max-[560px]:gap-[var(--space-3)]">
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
        </div>

        {/* Tab Content */}
        {activeTab === 'all-trays' && (
          <div className="dash-row grid grid-cols-12 gap-[var(--space-4)] max-[560px]:grid-cols-1 max-[560px]:gap-[var(--space-3)]">
            <div className="dash-card full col-span-full rounded-lg border border-border bg-surface p-0 shadow-sm">
              <TableWithControls
                title="Tray Management"
                columns={columns}
                rows={rows}
                selectable={!loading}
                onAddNew={() => setOpenAdd(true)}
                addNewText="Add New Tray"
                onImport={fetchTrays}
                importText="Refresh"
                dateRange={dateRange}
                onDateChange={setDateRange}
                itemName="Tray"
                loading={loading}
                serverPagination
                serverPage={trayPage}
                serverPageCount={trayPageCount}
                serverPageSize={20}
                serverTotal={trayTotal}
                onServerPageChange={(p) => fetchTraysPage(p)}
              />
              {error && !loading && (
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
              )}
            </div>
          </div>
        )}

        {activeTab === 'assign-products' && (
          <div className="dash-row grid grid-cols-12 gap-[var(--space-4)] max-[560px]:grid-cols-1 max-[560px]:gap-[var(--space-3)]">
            <div className="dash-card full col-span-full rounded-lg border border-border bg-surface p-0 shadow-sm">
              <div className="p-5">
                <h2 className="mt-0 mb-5">Assign Products to Tray</h2>

                {error && <div className="mb-3 rounded-lg border border-[#fcc] bg-[#fee] p-3 text-[red]">{error}</div>}

                {/* Single Section: Tray Selection, Add Product, and Products Table */}
                <div className="flex flex-col gap-6">
                  {/* Tray Selection */}
                  <div className="form-group">
                    <label className="ui-label" style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 700 }}>Select Tray</label>
                    <DropdownSelector
                      options={trays.map(t => ({
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
                    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-6">
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
                                border: `1px solid ${productDropdownOpen ? '#3b82f6' : '#e5e7eb'}`,
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
                                              backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                              borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                                              marginBottom: '2px',
                                              transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : 'transparent'; }}
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
                                              className="mr-[10px] h-4 w-4 shrink-0 cursor-pointer accent-[#3b82f6]"
                                            />
                                            <span className="text-[13px] leading-[1.4] text-[#333]">
                                              <strong className="text-[#111]">{p.model_no || 'N/A'}</strong>
                                              {(p.brand_name || p.collection_name) && (
                                                <span className="ml-[6px] text-[#888]">
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
                                    <span className="text-[12px] text-[#888]">
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
                      Products in Tray ({trayProducts.length})
                    </h3>
                    <div className="max-h-[500px] overflow-y-auto rounded-lg border border-[#e5e7eb]">
                      <table className="w-full border-collapse">
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
                              const product = allProducts.find(p => {
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
                                    <RowActions
                                      onEdit={() => startEditProduct(tp)}
                                      onDelete={() => handleRemoveProduct(tp)}
                                    />
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
        title="Add New Tray"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { resetForm(); setOpenAdd(false); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleSubmitNew}>Save</button>
          </>
        )}
      >
        <div className="ui-form">
          <div className="form-group">
            <label className="ui-label">Title</label>
            <input
              className="ui-input"
              placeholder="Tray title"
              value={form.tray_name}
              onChange={(e) => setForm((p) => ({ ...p, tray_name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Status</label>
            <DropdownSelector
              options={[
                { value: TrayStatus.AVAILABLE, label: 'AVAILABLE' },
                { value: TrayStatus.ASSIGNED, label: 'ASSIGNED' },
                { value: TrayStatus.CLOSED, label: 'CLOSED' }
              ]}
              value={form.tray_status}
              onChange={(value) => setForm((p) => ({ ...p, tray_status: value }))}
              placeholder="Select status"
            />
          </div>
        </div>
      </AsidePanel>
      <AsidePanel
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit Tray"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setEditRow(null); resetForm(); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleUpdate}>Update</button>
          </>
        )}
      >
        <div className="ui-form">
          <div className="form-group">
            <label className="ui-label">Title</label>
            <input
              className="ui-input"
              value={form.tray_name}
              onChange={(e) => setForm((p) => ({ ...p, tray_name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Status</label>
            <DropdownSelector
              options={[
                { value: TrayStatus.AVAILABLE, label: 'AVAILABLE' },
                { value: TrayStatus.ASSIGNED, label: 'ASSIGNED' },
                { value: TrayStatus.CLOSED, label: 'CLOSED' }
              ]}
              value={form.tray_status}
              onChange={(value) => setForm((p) => ({ ...p, tray_status: value }))}
              placeholder="Select status"
            />
          </div>
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
            const product = allProducts.find(p => {
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
