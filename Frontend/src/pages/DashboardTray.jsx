import React, { useEffect, useMemo, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import {
  getProducts,
  getBrands,
  getCollections,
  getTrays,
  updateTray,
  deleteTray,
  getProductsInTray,
  addProductToTray,
  updateProductInTray,
  deleteProductFromTray,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-orders.css';

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
  const [activeTab, setActiveTab] = useState('all-trays');
  const [dateRange, setDateRange] = useState('Feb 25, 2025 - Mar 25, 2025');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [trays, setTrays] = useState([]);
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

  const fetchTrays = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrays();
      setTrays(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load trays');
      setTrays([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const data = await getProducts();
      setAllProducts(data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      setAllProducts([]);
    }
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
    fetchTrays();
    fetchAllProducts();
    fetchBrands();
    fetchCollections();
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
    const confirmed = window.confirm(`Delete tray "${row.tray_name}"?`);
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
    const confirmed = window.confirm(`Remove product from tray?`);
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
    if (activeTab === 'assign-products') {
      // Load products, brands, and collections when switching to assign products tab
      if (allProducts.length === 0) {
        fetchAllProducts();
      }
      if (brands.length === 0) {
        fetchBrands();
      }
      if (collections.length === 0) {
        fetchCollections();
      }
    } else {
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
    <div className="dash-page">
      <div className="dash-container">
        {/* Tab Navigation */}
        <div className="dash-row">
          <div className="order-tabs-container">
            <button
              className={`order-tab ${activeTab === 'all-trays' ? 'active' : ''}`}
              onClick={() => setActiveTab('all-trays')}
            >
              All Trays
            </button>
            <button
              className={`order-tab ${activeTab === 'assign-products' ? 'active' : ''}`}
              onClick={() => setActiveTab('assign-products')}
            >
              Assign Products
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'all-trays' && (
          <div className="dash-row">
            <div className="dash-card full">
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
              />
              {error && <div style={{ padding: 12, color: 'red' }}>{error}</div>}
            </div>
          </div>
        )}

        {activeTab === 'assign-products' && (
          <div className="dash-row">
            <div className="dash-card full">
              <div style={{ padding: '20px' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Assign Products to Tray</h2>
                
                {error && <div style={{ padding: 12, color: 'red', marginBottom: 12, backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '8px' }}>{error}</div>}
                
                {/* Single Section: Tray Selection, Add Product, and Products Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    <div style={{ 
                      padding: '24px', 
                      backgroundColor: '#f9fafb', 
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h3 style={{ 
                        marginTop: 0, 
                        marginBottom: '20px',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#000000'
                      }}>
                        Add Products to Tray
                      </h3>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '16px'
                      }}>
                        <div className="form-group" style={{ position: 'relative' }}>
                          <label className="ui-label" style={{ marginBottom: '8px' }}>Select Products</label>
                          <div style={{ position: 'relative' }}>
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
                              <span style={{ fontSize: '12px', color: '#666' }}>
                                {productDropdownOpen ? '▲' : '▼'}
                              </span>
                            </button>

                            {productDropdownOpen && (
                              <>
                                {/* Dropdown panel */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    backgroundColor: '#fff',
                                    zIndex: 1001,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '270px'
                                  }}
                                >
                                  {/* Search bar — sticky top */}
                                  <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
                                    <input
                                      type="text"
                                      placeholder="🔍  Search by model, brand or collection..."
                                      value={productSearch}
                                      onChange={(e) => setProductSearch(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#f9fafb'
                                      }}
                                    />
                                  </div>

                                  {/* Product list — scrollable */}
                                  <div style={{ overflowY: 'auto', flex: 1, padding: '6px' }}>
                                    {allProducts.length === 0 ? (
                                      <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                                        No products available
                                      </div>
                                    ) : (() => {
                                      const filtered = allProducts.filter((p) => {
                                        if (!productSearch.trim()) return true;
                                        const q = productSearch.toLowerCase();
                                        return (
                                          (p.model_no || '').toLowerCase().includes(q) ||
                                          (p.brand_name || '').toLowerCase().includes(q) ||
                                          (p.collection_name || '').toLowerCase().includes(q)
                                        );
                                      });
                                      if (filtered.length === 0) return (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
                                          No products match "{productSearch}"
                                        </div>
                                      );
                                      return filtered.map((p) => {
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
                                              style={{ marginRight: '10px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6', flexShrink: 0 }}
                                            />
                                            <span style={{ fontSize: '13px', color: '#333', lineHeight: 1.4 }}>
                                              <strong style={{ color: '#111' }}>{p.model_no || 'N/A'}</strong>
                                              {(p.brand_name || p.collection_name) && (
                                                <span style={{ color: '#888', marginLeft: '6px' }}>
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
                                  <div style={{
                                    padding: '10px 12px',
                                    borderTop: '1px solid #f0f0f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexShrink: 0,
                                    backgroundColor: '#fafafa',
                                    borderRadius: '0 0 10px 10px'
                                  }}>
                                    <span style={{ fontSize: '12px', color: '#888' }}>
                                      {selectedProducts.length > 0 ? `${selectedProducts.length} selected` : 'None selected'}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
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
                                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
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
                    <h3 style={{ marginTop: 0, marginBottom: 15 }}>
                      Products in Tray ({trayProducts.length})
                    </h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>MODEL NO</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>BRAND</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>COLLECTION</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>MRP</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>WHP</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>QUANTITY</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>STATUS</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingProducts ? (
                            <tr>
                              <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                                Loading products...
                              </td>
                            </tr>
                          ) : trayProducts.length === 0 ? (
                            <tr>
                              <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                                {selectedTray ? 'No products in this tray' : 'Please select a tray to view products'}
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
                                <tr key={tp.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '12px' }}>
                                    {productData?.model_no || 'N/A'}
                                    {!product && productId && (
                                      <span style={{ fontSize: '10px', color: '#999', display: 'block' }}>
                                        (ID: {productId.substring(0, 8)}...)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    {brand?.brand_name || productData?.brand_name || 'N/A'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    {collection?.collection_name || productData?.collection_name || 'N/A'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    {productData?.mrp ? `₹${parseFloat(productData.mrp || 0).toLocaleString('en-IN')}` : 'N/A'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    {productData?.whp ? `₹${parseFloat(productData.whp || 0).toLocaleString('en-IN')}` : 'N/A'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    1
                                  </td>
                                  <td style={{ padding: '12px' }}>
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
                                  <td style={{ padding: '12px' }}>
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
      <Modal
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
      </Modal>
      <Modal
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
      </Modal>

      {/* Edit Product Status Modal */}
      <Modal
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
      </Modal>

    </div>
  );
};

export default DashboardTray;
