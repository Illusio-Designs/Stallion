import React, { useMemo, useState, useEffect, useCallback } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import { 
  getOrders, 
  createOrder, 
  updateOrderStatus, 
  deleteOrder,
  getProducts,
  getCountries
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import { getUser } from '../services/authService';
import '../styles/pages/dashboard-orders.css';

// Map API status to UI status
const mapApiStatusToUI = (apiStatus) => {
  const statusMap = {
    'pending': 'PENDING',
    'processed': 'PROCESSING',
    'hold_by_tray': 'HOLD BY TREY',
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
    'Hold by Trey': 'hold_by_tray',
    'Partially Dispatch': 'partially_dispatched',
    'Dispatch': 'dispatched',
    'Completed': 'completed',
    'Cancel': 'cancelled'
  };
  return tabMap[tab];
};

const DistributorOrders = () => {
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
  const [countries, setCountries] = useState([]);
  const [products, setProducts] = useState([]);
  
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
      const response = await getOrders();
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

  // Load create-order form data (products) only when the create modal opens.
  useEffect(() => {
    if (createModalOpen && products.length === 0) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createModalOpen]);

  // Update distributor_id when user data changes
  useEffect(() => {
    if (distributorId) {
      setCreateFormData(prev => ({ ...prev, distributor_id: distributorId }));
    }
  }, [distributorId]);

  // Fetch initial data for dropdowns
  const fetchInitialData = async () => {
    try {
      const [countriesData, productsData] = await Promise.all([
        getCountries(),
        getProducts()
      ]);
      setCountries(countriesData || []);
      setProducts(productsData || []);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
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
      const totalValue = parseFloat(order.order_total || order.total_value || order.total_amount || 0);
      
      // Display product information
      let productDisplay = 'No items';
      if (orderItems.length > 0) {
        if (orderItems.length === 1) {
          productDisplay = orderItems[0].product?.model_no || orderItems[0].product_name || 'Unknown Product';
        } else {
          productDisplay = `${orderItems.length} items`;
        }
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
  }, [orders]);

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
      return sum + (o.total_value || o.total_amount || 0);
    }, 0);
    const totalRevenue = orders.reduce((sum, o) => {
      return sum + (o.total_value || o.total_amount || 0);
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
    if (!window.confirm('Are you sure you want to delete this order?')) return;

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
      updateOrderItem(itemIndex, 'product_id', productId);
      updateOrderItem(itemIndex, 'price', price);
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
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions 
        onView={() => console.log('view', row)} 
        onDelete={() => handleDelete(row)} 
      />
    ) },
  ]), []);

  return (
    <div className="dash-page">
      <div className="dash-container">
        {/* Summary Cards */}
        <div className="dash-row orders-summary">
          <div className="dash-card metric orders-card">
            <h4>Total Orders</h4>
            <div className="metric-value">{loading ? 'Loading...' : `${summaryStats.totalOrders} Orders`}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Pending Orders</h4>
            <div className="metric-value">{loading ? 'Loading...' : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Completed Orders</h4>
            <div className="metric-value">{loading ? 'Loading...' : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Total Revenue</h4>
            <div className="metric-value">{loading ? 'Loading...' : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Status Tabs */}
        <div className="dash-row">
          <div className="order-tabs-container">
            {['All', 'Pending', 'Processing', 'Hold by Trey', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'].map(tab => (
              <button
                key={tab}
                className={`order-tab ${activeTab === tab ? 'active' : ''}`}
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
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal 
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
        <div className="ui-form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
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
              Order Items <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ border: '1px solid #E0E0E0', borderRadius: '8px', padding: '16px' }}>
              {createFormData.order_items.map((item, index) => (
                <div key={index} style={{ 
                  marginBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  paddingBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  borderBottom: index < createFormData.order_items.length - 1 ? '1px solid #E0E0E0' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>Product</label>
                      <select 
                        className="ui-select"
                        value={item.product_id}
                        onChange={(e) => handleProductSelect(index, e.target.value)}
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map(product => (
                          <option key={product.id || product.product_id} value={product.id || product.product_id}>
                            {product.model_no || product.product_name || product.name} 
                            {product.price ? ` - ₹${product.price}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>Quantity</label>
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
                      <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>Price</label>
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
      </Modal>
    </div>
  );
};

export default DistributorOrders;
