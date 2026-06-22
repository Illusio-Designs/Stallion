import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DropdownSelector from '../components/ui/DropdownSelector';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import Skeleton from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';
import TableWithControls from '../components/ui/TableWithControls';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  createOrder,
  deleteOrder,
  getMyOrders,
  getProductsPage
} from '../services/apiService';
import { getUser } from '../services/authService';
import { showError, showSuccess } from '../services/notificationService';
import '../styles/pages/dashboard-orders.css';

// Map API status to UI status
const mapApiStatusToUI = (apiStatus) => {
  const statusMap = {
    'pending': 'PENDING',
    'processed': 'PROCESSING',
    'hold_by_tray': 'HOLD BY SAMPLE',
    'partially_dispatched': 'PARTIALLY DISPATCH',
    'dispatched': 'DISPATCH',
    'completed': 'COMPLETED',
    'cancelled': 'CANCEL'
  };
  return statusMap[apiStatus?.toLowerCase()] || apiStatus?.toUpperCase() || 'PENDING';
};

// Map UI tab to API status
const mapUITabToApiStatus = (tab) => {
  const tabMap = {
    'Pending': 'pending',
    'Processing': 'processed',
    'Hold by Sample': 'hold_by_tray',
    'Partially Dispatch': 'partially_dispatched',
    'Dispatch': 'dispatched',
    'Completed': 'completed',
    'Cancel': 'cancelled'
  };
  return tabMap[tab];
};

const DistributorOrders = () => {
  const confirm = useConfirm();
  const [editRow, setEditRow] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [dateRange, setDateRange] = useState('Feb 24, 2023 - Mar 15, 2023');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const user = getUser();
  const distributorId = user?.distributor_id || user?.distributorId;

  // Dropdown data
  const [products, setProducts] = useState([]);
  const [productLoading, setProductLoading] = useState(false);

  // Create order form data - order_type is auto-set to distributor_order
  const [createFormData, setCreateFormData] = useState({
    order_type: 'distributor_order', // Auto-set for distributor
    distributor_id: distributorId || '',
    order_items: [{ product_id: '', quantity: 1, price: 0 }],
    order_notes: ''
  });

  // Fetch orders from API
  const fetchOrders = async (suppressError = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMyOrders();
      // Filter orders for this distributor
      const distributorOrders = distributorId
        ? response.filter(order =>
          (order.distributor_id || order.distributor?.id || order.distributor?.distributor_id) === distributorId ||
          order.order_type === 'distributor_order'
        )
        : response.filter(order => order.order_type === 'distributor_order');
      setOrders(Array.isArray(distributorOrders) ? distributorOrders : []);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch orders';
      const errorMessage = (message || '').toLowerCase();

      const isNotFoundError = errorMessage.includes('orders not found') ||
        errorMessage.includes('no orders found') ||
        errorMessage.includes('order not found') ||
        err.statusCode === 404;

      if (isNotFoundError) {
        setOrders([]);
        setError(null);
      } else {
        setError(message);
        if (!suppressError) {
          showError(message);
        }
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
  }, []);

  // Update distributor_id when user data changes
  useEffect(() => {
    if (distributorId) {
      setCreateFormData(prev => ({ ...prev, distributor_id: distributorId }));
    }
  }, [distributorId]);

  // Product picker: server-paginated, 20 per page, with server-side search.
  // Opening loads page 1; typing re-queries the server (debounced).
  const loadProducts = async (search = '') => {
    setProductLoading(true);
    try {
      const result = await getProductsPage(1, 20, search);
      setProducts(Array.isArray(result) ? result : (result?.data || []));
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setProductLoading(false);
    }
  };

  // Helper function to parse order_items (can be JSON string or array)
  const parseOrderItems = (orderItems) => {
    if (!orderItems) return [];

    // If it's already an array, return it
    if (Array.isArray(orderItems)) {
      return orderItems;
    }

    // If it's a JSON string, parse it
    if (typeof orderItems === 'string') {
      try {
        const parsed = JSON.parse(orderItems);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Failed to parse order_items JSON:', e);
        return [];
      }
    }

    // If it's an object, try to get values
    if (typeof orderItems === 'object') {
      return Object.values(orderItems);
    }

    return [];
  };

  // Transform orders data to table rows
  const rows = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const tableRows = [];
    orders.forEach(order => {
      const orderId = order.order_id || order.id;
      const orderNumber = order.order_number || `#${orderId?.toString().slice(-6) || 'N/A'}`;
      // Get party name from order object, try multiple possible field names
      const partyName = order.party?.party_name ||
        order.party_name ||
        order.party?.name ||
        (order.party_id ? `Party ${order.party_id.slice(0, 8)}...` : 'N/A');
      const orderStatus = mapApiStatusToUI(order.order_status);

      // Parse order_items (can be JSON string or array)
      const orderItems = parseOrderItems(order.order_items);

      // Format order type for display
      const formatOrderType = (type) => {
        if (!type) return 'N/A';
        return type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };
      const orderTypeDisplay = formatOrderType(order.order_type);

      // Calculate totals for the order
      const totalQuantity = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalValue = parseFloat(order.order_total || Number(order.order_total) || order.total_value || order.total_amount || 0);

      // order_items store {product_id, quantity, price} (no model_no), so resolve
      // the product name via the loaded products list.
      const itemName = (it) =>
        it.model_no ||
        products.find(p => String(p.product_id || p.id) === String(it.product_id))?.model_no ||
        products.find(p => String(p.product_id || p.id) === String(it.product_id))?.product_name ||
        'Unknown Product';
      let productDisplay = 'No items';
      if (orderItems.length === 1) {
        productDisplay = itemName(orderItems[0]);
      } else if (orderItems.length > 1) {
        productDisplay = `${itemName(orderItems[0])} +${orderItems.length - 1} more`;
      }

      // Create a single row for the order
      tableRows.push({
        id: orderId,
        orderId: orderNumber,
        orderType: orderTypeDisplay,
        client: partyName,
        product: productDisplay,
        qty: totalQuantity,
        status: orderStatus,
        value: `₹${totalValue.toLocaleString('en-IN')}`,
        originalOrder: order
      });
    });

    return tableRows;
  }, [orders, products]);

  // Filter rows by active tab
  const filteredRowsByTab = useMemo(() => {
    if (activeTab === 'All') return rows;
    const apiStatus = mapUITabToApiStatus(activeTab);
    if (!apiStatus) return rows;

    return rows.filter(row => {
      const rowStatus = row.originalOrder?.order_status?.toLowerCase();
      return rowStatus === apiStatus;
    });
  }, [rows, activeTab]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.order_status?.toLowerCase() === 'pending').length;
    const completedOrders = orders.filter(o => o.order_status?.toLowerCase() === 'completed');
    const completedValue = completedOrders.reduce((sum, o) => {
      return sum + (Number(o.order_total) || o.total_value || o.total_amount || 0);
    }, 0);
    const totalRevenue = orders.reduce((sum, o) => {
      return sum + (Number(o.order_total) || o.total_value || o.total_amount || 0);
    }, 0);

    return {
      totalOrders,
      pendingOrders,
      completedValue,
      totalRevenue,
    };
  }, [orders]);

  // Handle delete order
  const handleDelete = async (row) => {
    if (!(await confirm('Are you sure you want to delete this order?'))) return;

    try {
      setLoading(true);
      const orderId = row.originalOrder?.order_id || row.originalOrder?.id;
      if (!orderId) {
        showError('Order ID not found');
        return;
      }

      await deleteOrder(orderId);
      showSuccess('Order deleted successfully');
      await fetchOrders();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to delete order';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle create order
  const handleCreateOrder = async () => {
    try {
      // Validation
      if (!distributorId) {
        showError('Distributor ID not found. Please contact support.');
        return;
      }
      if (createFormData.order_items.length === 0 ||
        createFormData.order_items.some(item => !item.product_id || !item.quantity || !item.price)) {
        showError('Please add at least one valid order item');
        return;
      }

      setLoading(true);

      // Prepare order data - order_type is always distributor_order, order_date is automatically set to current date/time
      const orderData = {
        order_date: new Date().toISOString(),
        order_type: 'distributor_order', // Always distributor_order for distributor users
        distributor_id: distributorId,
        order_items: createFormData.order_items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price)
        }))
      };

      if (createFormData.order_notes) orderData.order_notes = createFormData.order_notes;

      await createOrder(orderData);
      showSuccess('Order created successfully');
      setCreateModalOpen(false);
      resetCreateForm();
      await fetchOrders(true);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to create order';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateFormData({
      order_type: 'distributor_order',
      distributor_id: distributorId || '',
      order_items: [{ product_id: '', quantity: 1, price: 0 }],
      order_notes: ''
    });
  };

  // Add order item
  const addOrderItem = () => {
    setCreateFormData(prev => ({
      ...prev,
      order_items: [...prev.order_items, { product_id: '', quantity: 1, price: 0 }]
    }));
  };

  // Remove order item
  const removeOrderItem = (index) => {
    setCreateFormData(prev => ({
      ...prev,
      order_items: prev.order_items.filter((_, i) => i !== index)
    }));
  };

  // Update order item
  const updateOrderItem = (index, field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      order_items: prev.order_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Get product price when product is selected
  const handleProductSelect = (itemIndex, productId) => {
    const product = products.find(p => (p.product_id || p.id) === productId);
    if (product) {
      const price = product.price || product.selling_price || 0;
      const label = `${product.model_no || product.product_name || product.name}${price ? ` - ₹${price}` : ''}`;
      updateOrderItem(itemIndex, 'product_id', productId);
      updateOrderItem(itemIndex, 'price', price);
      updateOrderItem(itemIndex, 'product_label', label);
    } else {
      updateOrderItem(itemIndex, 'product_id', productId);
    }
  };

  const columns = useMemo(() => ([
    { key: 'orderId', label: 'ORDER ID' },
    { key: 'orderType', label: 'ORDER TYPE' },
    { key: 'client', label: 'PARTY NAME' },
    { key: 'product', label: 'PRODUCT' },
    { key: 'qty', label: 'QTY' },
    { key: 'status', label: 'STATUS', render: (v) => <StatusBadge status={String(v).toLowerCase().replace(/\s+/g, '-')}>{v}</StatusBadge> },
    { key: 'value', label: 'VALUE' },
    {
      key: 'action', label: 'ACTION', render: (_v, row) => (
        <RowActions
          onView={() => console.log('view', row)}
          onDelete={() => handleDelete(row)}
        />
      )
    },
  ]), []);

  return (
    <div className="dash-page">
      <div className="dash-container">
        {/* Summary Cards */}
        <div className="dash-row orders-summary mb-5">
          <div className="dash-card metric orders-card p-5">
            <h4 className="text-text-subtle text-xs font-medium tracking-[var(--tracking-label)] mb-3 uppercase">Total Orders</h4>
            <div className="metric-value text-[var(--text-lg)] font-semibold text-text mb-2 leading-tight tracking-[-0.01em]">{loading ? <Skeleton width={90} height={24} /> : `${summaryStats.totalOrders} Orders`}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="text-text-subtle text-xs font-medium tracking-[var(--tracking-label)] mb-3 uppercase">Pending Orders</h4>
            <div className="metric-value text-[var(--text-lg)] font-semibold text-text mb-2 leading-tight tracking-[-0.01em]">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="text-text-subtle text-xs font-medium tracking-[var(--tracking-label)] mb-3 uppercase">Completed Orders</h4>
            <div className="metric-value text-[var(--text-lg)] font-semibold text-text mb-2 leading-tight tracking-[-0.01em]">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="text-text-subtle text-xs font-medium tracking-[var(--tracking-label)] mb-3 uppercase">Total Revenue</h4>
            <div className="metric-value text-[var(--text-lg)] font-semibold text-text mb-2 leading-tight tracking-[-0.01em]">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Status Tabs */}
        <div className="dash-row">
          <div className="order-tabs-container bg-surface border border-border rounded-lg shadow-sm flex gap-2 overflow-x-auto px-3 py-2 w-full [grid-column:1/-1] [scrollbar-width:thin]">
            {['All', 'Pending', 'Processing', 'Hold by Sample', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'].map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex items-center min-h-10 px-4 py-2 rounded-md font-semibold text-[var(--text-base)] leading-snug cursor-pointer whitespace-nowrap shrink-0 transition-[background,color,box-shadow] duration-[0.12s] ease-[ease] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] ${activeTab === tab
                    ? 'active bg-primary text-text-on-primary'
                    : 'text-text-muted hover:bg-primary-soft hover:text-primary'
                  }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Order Overview Table */}
        <div className="dash-row">
          <div className="dash-card full">
            {!loading && error ? (
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn't load orders</p>
                <p className="ui-state__desc">{error}</p>
                <button className="ui-btn ui-btn--secondary" onClick={() => fetchOrders()}>Try again</button>
              </div>
            ) : !loading && filteredRowsByTab.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <path d="M6 2h9l5 5v15a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0V2Z" />
                    <path d="M14 2v6h6" />
                    <line x1="9" y1="13" x2="15" y2="13" />
                    <line x1="9" y1="17" x2="13" y2="17" />
                  </svg>
                </div>
                <p className="ui-state__title">No orders yet</p>
                <p className="ui-state__desc">
                  {activeTab === 'All'
                    ? "You haven't placed any orders. Create your first order to get started."
                    : `No orders found in "${activeTab}".`}
                </p>
                {activeTab === 'All' && (
                  <button className="ui-btn ui-btn--primary" onClick={() => setCreateModalOpen(true)}>Create Order</button>
                )}
              </div>
            ) : (
              <TableWithControls
                title="My Orders"
                columns={columns}
                rows={filteredRowsByTab}
                onAddNew={() => setCreateModalOpen(true)}
                addNewText="Create Order"
                dateRange={dateRange}
                onDateChange={setDateRange}
                itemName="Order"
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      <AsidePanel
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetCreateForm();
        }}
        title="Create New Order"
        footer={(
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateModalOpen(false);
                resetCreateForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Order'}
            </Button>
          </>
        )}
      >
        <div className="ui-form max-h-[70vh] overflow-y-auto">
          {/* Order Type - Hidden, auto-set to distributor_order */}
          <div className="form-group" style={{ display: 'none' }}>
            <label className="ui-label">Order Type</label>
            <input
              className="ui-input"
              value="Distributor Order"
              disabled
            />
          </div>

          {/* Order Items */}
          <div className="form-group">
            <label className="ui-label">
              Order Items <span className="text-[red]">*</span>
            </label>
            <div className="border border-[#E0E0E0] rounded-lg p-4">
              {createFormData.order_items.map((item, index) => (
                <div key={index} style={{
                  marginBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  paddingBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  borderBottom: index < createFormData.order_items.length - 1 ? '1px solid #E0E0E0' : 'none'
                }}>
                  <div className="flex justify-between items-center mb-2">
                    <strong>Item {index + 1}</strong>
                    {createFormData.order_items.length > 1 && (
                      <Button
                        variant="secondary"
                        onClick={() => removeOrderItem(index)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-[#666] mb-1 block">Product</label>
                      <DropdownSelector
                        options={products.map(product => ({
                          value: product.id || product.product_id,
                          label: `${product.model_no || product.product_name || product.name}${product.price ? ` - ₹${product.price}` : ''}`,
                        }))}
                        value={item.product_id || ''}
                        onChange={(value) => handleProductSelect(index, value)}
                        serverSearch
                        loading={productLoading}
                        selectedLabel={item.product_label || ''}
                        onOpen={() => loadProducts('')}
                        onSearch={loadProducts}
                        placeholder="Select Product"
                        className="ui-dropdown-custom--full-width"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#666] mb-1 block">Quantity</label>
                      <input
                        type="number"
                        className="ui-input"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)}
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#666] mb-1 block">Price</label>
                      <input
                        type="number"
                        className="ui-input"
                        value={item.price}
                        onChange={(e) => updateOrderItem(index, 'price', e.target.value)}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={addOrderItem}
                style={{ marginTop: '12px', width: '100%' }}
              >
                + Add Item
              </Button>
            </div>
          </div>

          {/* Order Notes */}
          <div className="form-group">
            <label className="ui-label">Order Notes</label>
            <textarea
              className="ui-input"
              value={createFormData.order_notes}
              onChange={(e) => setCreateFormData(prev => ({ ...prev, order_notes: e.target.value }))}
              rows="3"
              placeholder="Optional notes about this order"
            />
          </div>
        </div>
      </AsidePanel>
    </div>
  );
};

export default DistributorOrders;
