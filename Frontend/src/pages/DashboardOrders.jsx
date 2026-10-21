import React, { useMemo, useState, useEffect } from 'react';
import Skeleton from '../components/ui/Skeleton';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  getOrdersForRole,
  updateOrderStatus, 
  deleteOrder,
  getPartiesForRole,
  getProductsByIds,
  getSalesmanById,
} from '../services/apiService';
import { downloadOrderPdf } from '../utils/orderPdf';
import { downloadCsv } from '../utils/exportCsv';
import { showSuccess, showError } from '../services/notificationService';
import { getUserRole, getUser, getUserRoles } from '../services/authService';
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

// Canonical UI-status label <-> API status value (single source of truth for
// the edit modal). Keep in sync with mapApiStatusToUI above.
const UI_TO_API_STATUS = {
  'PENDING': 'pending',
  'PROCESSING': 'processed',
  'HOLD BY SAMPLE': 'hold_by_tray',
  'PARTIALLY DISPATCH': 'partially_dispatched',
  'DISPATCH': 'dispatched',
  'COMPLETED': 'completed',
  'CANCEL': 'cancelled',
};
// Statuses that require courier name + tracking number (and, for partial,
// a dispatch quantity) — mirrors the backend validation.
const DISPATCH_STATUSES = ['dispatched', 'partially_dispatched'];

const DashboardOrders = () => {
  const confirm = useConfirm();
  const [editRow, setEditRow] = useState(null);
  const [editStatus, setEditStatus] = useState('PENDING');
  // Extra data captured for dispatch / partial-dispatch status changes
  const [courierName, setCourierName] = useState('');
  const [courierTracking, setCourierTracking] = useState('');
  const [partialQty, setPartialQty] = useState('');
  const [viewRow, setViewRow] = useState(null);
  const [viewItems, setViewItems] = useState([]);
  const [viewItemsLoading, setViewItemsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [dateFrom, setDateFrom] = useState(null); // 'YYYY-MM-DD' or null
  const [dateTo, setDateTo] = useState(null);     // 'YYYY-MM-DD' or null
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partyNamesMap, setPartyNamesMap] = useState({}); // Map of party_id -> party_name
  const [partyAddressMap, setPartyAddressMap] = useState({}); // Map of party_id -> address string
  const [salesmanNamesMap, setSalesmanNamesMap] = useState({}); // Map of salesman_id -> name
  // Memoize so the reference is stable across renders — getUser()/getUserRole()
  // parse localStorage and return a fresh object each call, which otherwise
  // re-creates every useCallback that depends on `user` and causes an infinite
  // render loop (the parties-fetch effect re-fires forever).
  const userRole = useMemo(() => getUserRole(), []);
  const user = useMemo(() => getUser(), []);
  const isAdmin = userRole === 'admin';
  const isDistributor = userRole === 'distributor';
  const isParty = userRole === 'party';
  const isSalesman = userRole === 'salesman';
  // Changing an order's status is for admin and order manager only (the server
  // answers "Access denied" to everyone else), so only they get the Edit button.
  const canEditOrder = useMemo(
    () => getUserRoles().some((r) => ['admin', 'order_manager'].includes(r)),
    []
  );
  
  // Fetch orders from API
  const fetchOrders = async (suppressError = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getOrdersForRole(userRole);
      let allOrders = Array.isArray(response) ? response : [];
      
      // Filter orders based on role - only show orders created by the logged-in user
      if (isDistributor && user?.distributor_id) {
        // Filter orders for this distributor
        const distributorId = String(user.distributor_id).trim();
        allOrders = allOrders.filter(order => {
          const orderDistributorId = order.distributor_id || order.distributor?.distributor_id || order.distributor?.id;
          return orderDistributorId && String(orderDistributorId).trim() === distributorId;
        });
        console.log('[fetchOrders] Filtered orders for distributor:', distributorId, 'Total:', allOrders.length);
      } else if (isParty && user?.party_id) {
        // Filter orders for this party
        const partyId = String(user.party_id).trim();
        allOrders = allOrders.filter(order => {
          const orderPartyId = order.party_id || order.party?.party_id || order.party?.id;
          return orderPartyId && String(orderPartyId).trim() === partyId;
        });
        console.log('[fetchOrders] Filtered orders for party:', partyId, 'Total:', allOrders.length);
      } else if (isSalesman && user?.salesman_id) {
        // Filter orders for this salesman
        const salesmanId = String(user.salesman_id).trim();
        allOrders = allOrders.filter(order => {
          const orderSalesmanId = order.salesman_id || order.salesman?.salesman_id || order.salesman?.id;
          return orderSalesmanId && String(orderSalesmanId).trim() === salesmanId;
        });
        console.log('[fetchOrders] Filtered orders for salesman:', salesmanId, 'Total:', allOrders.length);
      }
      // Admin sees all orders (no filtering)
      
      setOrders(allOrders);
      
      // Fetch party details (name + address) for the orders' parties. We need
      // the address for the View/Download "From" block even when the name is
      // already embedded, so key off any party_id present.
      const uniquePartyIds = [...new Set(allOrders
        .filter(order => order.party_id)
        .map(order => order.party_id)
      )];

      if (uniquePartyIds.length > 0) {
        try {
          // One call for all parties instead of one getPartyById per order (N+1).
          // Role-scoped: field roles (salesman/distributor/party) get /parties/my;
          // managers get the full list. Avoids a 403 on POST /parties/get.
          const allParties = await getPartiesForRole(userRole);
          const newPartyNamesMap = { ...partyNamesMap };
          const newPartyAddressMap = { ...partyAddressMap };
          (allParties || []).forEach((p) => {
            const id = p.id || p.party_id;
            if (!id) return;
            newPartyNamesMap[id] = p.party_name || p.name || 'N/A';
            const addr = [p.address, p.pincode].filter(Boolean).join(' - ');
            if (addr) newPartyAddressMap[id] = addr;
          });
          setPartyNamesMap(newPartyNamesMap);
          setPartyAddressMap(newPartyAddressMap);
        } catch (err) {
          console.error('Failed to fetch party details:', err);
        }
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch orders';
      const errorMessage = (message || '').toLowerCase();
      
      // Don't show error for "not found" cases - it's a valid empty state
      const isNotFoundError = errorMessage.includes('orders not found') ||
                             errorMessage.includes('no orders found') ||
                             errorMessage.includes('order not found') ||
                             err.statusCode === 404;
      
      if (isNotFoundError) {
        // Just set empty array, don't show error
        setOrders([]);
        setError(null);
      } else {
        // Only show error if not suppressed and not a "not found" error
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

  // Fetch orders on mount. Product names are resolved on-demand in the View
  // modal (per order), so we don't bulk-load the catalog here.
  useEffect(() => {
    fetchOrders();
  }, []);

  // Resolve salesman names for the SALESMAN column (orders only carry salesman_id).
  useEffect(() => {
    const ids = [...new Set(
      orders.map(o => o.salesman_id || o.salesman?.salesman_id || o.salesman?.id).filter(Boolean)
    )].filter(id => !salesmanNamesMap[id]);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const s = await getSalesmanById(id);
          const sm = s?.data || s;
          if (sm) map[id] = sm.full_name || sm.salesman_name || sm.name;
        } catch { /* leave unresolved */ }
      }));
      if (!cancelled && Object.keys(map).length) setSalesmanNamesMap(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

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

  // Resolve product names for the order shown in the View modal. order_items only
  // carry product_id, so anything not already embedded is looked up by id. This is
  // on-demand (only when a modal opens) so the listing keeps its limit of 20.
  useEffect(() => {
    if (!viewRow) {
      setViewItems([]);
      return;
    }
    const items = parseOrderItems(viewRow.originalOrder?.order_items);
    if (items.length === 0) {
      setViewItems([]);
      return;
    }

    const nameFrom = (it, lookup) =>
      it.model_no ||
      it.product?.model_no ||
      it.product_name ||
      it.product?.product_name ||
      lookup[String(it.product_id)] ||
      null;

    let cancelled = false;
    (async () => {
      const unresolved = [...new Set(
        items.filter(it => !nameFrom(it, {})).map(it => String(it.product_id)).filter(Boolean)
      )];

      const lookup = {};
      if (unresolved.length > 0) {
        setViewItemsLoading(true);
        // One call for every unresolved item in this order (limit = id count),
        // not one 1000-row call per item.
        try {
          const fetched = await getProductsByIds(unresolved);
          fetched.forEach((p) => {
            lookup[String(p.product_id ?? p.id)] = p.model_no || p.product_name || p.name;
          });
        } catch { /* leave unresolved */ }
      }
      if (cancelled) return;
      setViewItems(items.map(it => ({
        ...it,
        _name: nameFrom(it, lookup) || 'Unknown Product',
        _subtotal: (Number(it.quantity) || 0) * (Number(it.price) || 0),
      })));
      setViewItemsLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRow]);

  // Transform orders data to table rows
  const rows = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    const tableRows = [];
    orders.forEach(order => {
      const orderId = order.order_id || order.id;
      const orderNumber = order.order_number || `#${orderId?.toString().slice(-6) || 'N/A'}`;
      // Get party name from order object, or from partyNamesMap if not available
      const partyName = order.party?.party_name ||
                       order.party_name ||
                       (order.party_id ? partyNamesMap[order.party_id] : null) ||
                       'N/A';
      // Party shipping + billing address. The order response now includes these
      // directly (party_address / party_billing_address); fall back to the
      // nested party object / lookup map for older responses.
      const partyAddress = order.party_address ||
                       [order.party?.address, order.party?.pincode].filter(Boolean).join(' - ') ||
                       (order.party_id ? partyAddressMap[order.party_id] : '') || '';
      const partyBillingAddress = order.party_billing_address || order.party?.billing_address || '';
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

      const rawDate = order.order_date || order.created_at;
      const orderDate = rawDate
        ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      const orderSalesmanId = order.salesman_id || order.salesman?.salesman_id || order.salesman?.id;
      const salesmanLabel = order.salesman?.salesman_name || order.salesman?.full_name || order.salesman_name ||
        (orderSalesmanId ? (salesmanNamesMap[orderSalesmanId] || `Salesman ${String(orderSalesmanId).slice(0, 8)}`) : '—');

      // Create a single row for the order. The product breakdown lives in the
      // View modal (per-order item table), so it's not a list column.
      tableRows.push({
        id: orderId,
        orderId: orderNumber,
        orderType: orderTypeDisplay,
        client: partyName,
        clientAddress: partyAddress,
        partyCity: (typeof order.party?.city === 'string' ? order.party.city : order.party?.city?.name) || order.party_city || '',
        clientBillingAddress: partyBillingAddress,
        salesman: salesmanLabel,
        date: orderDate,
        qty: totalQuantity,
        status: orderStatus,
        value: `₹${totalValue.toLocaleString('en-IN')}`,
        originalOrder: order
      });
    });

    return tableRows;
  }, [orders, partyNamesMap, partyAddressMap, salesmanNamesMap]);

  // Filter rows by active tab + selected date range
  const filteredRowsByTab = useMemo(() => {
    let result = rows;

    if (activeTab !== 'All') {
      const apiStatus = mapUITabToApiStatus(activeTab);
      if (apiStatus) {
        result = result.filter(row => row.originalOrder?.order_status?.toLowerCase() === apiStatus);
      }
    }

    if (dateFrom || dateTo) {
      const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity;
      const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Infinity;
      result = result.filter(row => {
        const raw = row.originalOrder?.order_date || row.originalOrder?.created_at;
        if (!raw) return false;
        const ts = new Date(raw).getTime();
        return !Number.isNaN(ts) && ts >= fromTs && ts <= toTs;
      });
    }

    return result;
  }, [rows, activeTab, dateFrom, dateTo]);

  // Counts shown on the status chips
  const tabCounts = useMemo(() => {
    const out = { All: orders.length };
    ['Pending', 'Processing', 'Hold by Sample', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'].forEach((t) => {
      const api = mapUITabToApiStatus(t);
      out[t] = orders.filter((o) => o.order_status?.toLowerCase() === api).length;
    });
    return out;
  }, [orders]);

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

    // Count by order type
    const retailOrders = orders.filter(o => o.order_type?.includes('retail') || o.order_type === 'retail_order').length;
    const bulkOrders = orders.filter(o => o.order_type?.includes('bulk') || o.order_type === 'bulk_order').length;

    return {
      totalOrders,
      pendingOrders,
      completedValue,
      totalRevenue,
      retailOrders,
      bulkOrders
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

  // Handle update order status
  const handleUpdateStatus = async (row, newStatus, overrides = null) => {
    const orderId = row.originalOrder?.order_id || row.originalOrder?.id;
    if (!orderId) {
      showError('Order ID not found');
      return;
    }

    const apiStatus = UI_TO_API_STATUS[newStatus] || newStatus.toLowerCase();
    const payload = { order_status: apiStatus };

    // Dispatch & partial-dispatch require courier details; partial also needs a
    // dispatched quantity. Validate client-side (toast, panel stays open) so we
    // don't bounce off the backend's 400.
    if (DISPATCH_STATUSES.includes(apiStatus)) {
      const name = String(overrides?.courierName ?? courierName).trim();
      const tracking = String(overrides?.courierTracking ?? courierTracking).trim();
      if (!name || !tracking) {
        showError('Courier name and tracking number are required to dispatch this order.');
        return;
      }
      payload.courier_name = name;
      payload.courier_tracking_number = tracking;
    }
    if (apiStatus === 'partially_dispatched') {
      const qty = Number(partialQty);
      const totalQty = Number(row.qty) || 0;
      if (!partialQty || !Number.isFinite(qty) || qty <= 0) {
        showError('Enter a valid partial dispatch quantity (greater than 0).');
        return;
      }
      if (totalQty > 0 && qty > totalQty) {
        showError(`Partial dispatch quantity cannot exceed the order quantity (${totalQty}).`);
        return;
      }
      payload.partial_dispatch_qty = qty;
    }

    // Confirm before committing — a status change can't be reversed. Uses the
    // app ConfirmDialog (via useConfirm), same as the delete confirmations.
    if (!(await confirm({
      title: 'Update order status',
      message: `Change this order's status to "${newStatus}"? This action cannot be undone.`,
      confirmLabel: 'Update status',
      danger: true,
    }))) {
      return;
    }

    try {
      setLoading(true);
      await updateOrderStatus(orderId, payload);
      showSuccess('Order status updated successfully', null, 'Status updated', `${row.orderId || 'Order'} is now ${String(newStatus).toLowerCase()}.`);
      await fetchOrders();
      closeEditPanel();
      setViewRow(null);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to update order status';
      showError(message, null, 'Status not updated', message);
    } finally {
      setLoading(false);
    }
  };

  // "Mark dispatched" (order detail): same status update as the edit panel. When
  // the order already has courier details it dispatches straight away; otherwise
  // the edit panel opens on Dispatch so the courier details can be entered.
  const handleMarkDispatched = (row) => {
    const o = row?.originalOrder || {};
    if (o.courier_name && o.courier_tracking_number) {
      handleUpdateStatus(row, 'DISPATCH', { courierName: o.courier_name, courierTracking: o.courier_tracking_number });
    } else {
      setViewRow(null);
      openEditPanel(row);
      setEditStatus('DISPATCH');
    }
  };

  const handleExportOrders = () => {
    downloadCsv('orders', [
      { label: 'Order', value: r => r.orderId },
      { label: 'Type', value: r => r.orderType },
      { label: 'Party', value: r => r.client },
      { label: 'Salesman', value: r => r.salesman },
      { label: 'Date', value: r => r.date },
      { label: 'Quantity', value: r => r.qty },
      { label: 'Status', value: r => r.status },
      { label: 'Total', value: r => Number(r.originalOrder?.order_total ?? 0) || 0 },
    ], filteredRowsByTab);
  };

  // Open the edit panel for a row, pre-filling status + any existing courier
  // details so an edit doesn't wipe them.
  const openEditPanel = (row) => {
    setEditRow(row);
    setEditStatus(row?.status || 'PENDING');
    setCourierName(row?.originalOrder?.courier_name || '');
    setCourierTracking(row?.originalOrder?.courier_tracking_number || '');
    setPartialQty(
      row?.originalOrder?.partial_dispatch_qty != null
        ? String(row.originalOrder.partial_dispatch_qty)
        : ''
    );
  };

  const closeEditPanel = () => {
    setEditRow(null);
    setEditStatus('PENDING');
    setCourierName('');
    setCourierTracking('');
    setPartialQty('');
  };


  // Download the order as a branded PDF (shared generator — see utils/orderPdf).
  const handleDownload = (row) => downloadOrderPdf(row, []);

  const columns = useMemo(() => ([
    { key: 'orderId', label: 'ORDER', render: (v, row) => (
      <span className="ord-cell"><b className="ord-cell__id">{v}</b>{row.orderType && row.orderType !== 'N/A' && <span className="ord-cell__sub">{row.orderType}</span>}</span>
    ) },
    { key: 'client', label: 'PARTY', render: (v, row) => (
      <span className="ord-cell"><b>{v}</b>{row.partyCity && <span className="ord-cell__sub">{row.partyCity}</span>}</span>
    ) },
    { key: 'salesman', label: 'SALESMAN' },
    { key: 'date', label: 'PLACED', render: (v) => <span className="ord-muted">{v}</span> },
    { key: 'status', label: 'STATUS', render: (v) => <StatusBadge status={String(v).toLowerCase().replace(/\s+/g, '-')}>{v}</StatusBadge> },
    { key: 'value', label: 'AMOUNT', render: (v) => <b className="ord-amount">{v}</b> },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions
        onView={() => setViewRow(row)}
        onEdit={canEditOrder ? () => openEditPanel(row) : undefined}
        onDownload={() => handleDownload(row)}
        // Delete is admin-only (the backend also enforces canManageOrders).
      />
    ) },
  ]), [isAdmin, canEditOrder]);

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="pg-head">
          <div><h1>Orders</h1><p>Stock is taken when an order is placed and returned when it is cancelled.</p></div>
          <div className="pg-head__tools">
            <button type="button" className="gbtn" onClick={handleExportOrders} disabled={loading || filteredRowsByTab.length === 0}>Export CSV</button>
          </div>
        </div>
        {/* Summary Cards */}
        <div className="dash-row orders-summary mb-5">
          <div className="dash-card metric orders-card p-5">
            <h4 className="mb-3 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-label)] text-text-subtle">Total Orders</h4>
            <div className="metric-value mb-2 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">{loading ? <Skeleton width={90} height={24} /> : `${summaryStats.totalOrders} Orders`}</div>
            <div className="metric-sub flex items-center gap-1 text-[length:var(--text-xs)] font-medium text-text-muted">Retail {summaryStats.retailOrders} | Bulk {summaryStats.bulkOrders}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="mb-3 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-label)] text-text-subtle">Pending Orders</h4>
            <div className="metric-value mb-2 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="mb-3 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-label)] text-text-subtle">Completed Orders</h4>
            <div className="metric-value mb-2 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card p-5">
            <h4 className="mb-3 text-[length:var(--text-xs)] font-medium uppercase tracking-[var(--tracking-label)] text-text-subtle">Total Revenue</h4>
            <div className="metric-value mb-2 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Status Tabs */}
        <div className="dash-row">
          <div className="order-tabs-container col-[1/-1] flex w-full gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
            {['All', 'Pending', 'Processing', 'Hold by Sample', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'].map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[length:var(--text-base)] font-semibold leading-[var(--leading-snug)] transition-[background,color,box-shadow] duration-[0.12s] ease-out focus-visible:outline-none active:scale-[0.98] ${activeTab === tab ? 'active bg-primary text-text-on-primary' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                <b className="order-tab__count">{tabCounts[tab] ?? 0}</b>
              </button>
            ))}
          </div>
        </div>

        {/* Order Overview Table */}
        <div className="dash-row">
          <div className="dash-card full">
            {error && !loading ? (
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8V12M12 16H12.01M12 3L2 20H22L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn't load orders</p>
                <p className="ui-state__desc">{error}</p>
                <button className="ui-btn ui-btn--secondary" onClick={() => fetchOrders()}>Try again</button>
              </div>
            ) : !loading && orders.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 5H7C5.895 5 5 5.895 5 7V19C5 20.105 5.895 21 7 21H17C18.105 21 19 20.105 19 19V7C19 5.895 18.105 5 17 5H15M9 5C9 6.105 9.895 7 11 7H13C14.105 7 15 6.105 15 5M9 5C9 3.895 9.895 3 11 3H13C14.105 3 15 3.895 15 5M9 12H15M9 16H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="ui-state__title">No orders yet</p>
                <p className="ui-state__desc">Orders placed from the shop will show up here.</p>
              </div>
            ) : (
              <TableWithControls
                title="Order Overview"
                columns={columns}
                rows={filteredRowsByTab}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateRangeChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }}
                itemName="Order"
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>

      {/* View Order Modal */}
      <AsidePanel open={!!viewRow} onClose={() => setViewRow(null)} title="Order Details" footer={(
        <>
          {viewRow && canEditOrder && !['DISPATCH', 'COMPLETED', 'CANCEL'].includes(viewRow.status) && (
            <Button variant="secondary" onClick={() => handleMarkDispatched(viewRow)} disabled={loading}>Mark dispatched</Button>
          )}
          <Button onClick={() => setViewRow(null)}>Close</Button>
        </>
      )}>
        {viewRow && (() => {
          const order = viewRow.originalOrder;
          const rawDate = order?.order_date || order?.created_at;
          const orderDate = rawDate
            ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
          return (
            <div className="ord-view">
              <div className="ord-view__summary">
                <div className="ord-field">
                  <span className="ord-field__label">Order ID</span>
                  <span className="ord-field__value">{viewRow.orderId || '—'}</span>
                </div>
                <div className="ord-field">
                  <span className="ord-field__label">Order Type</span>
                  <span className="ord-field__value">{viewRow.orderType || '—'}</span>
                </div>
                <div className="ord-field">
                  <span className="ord-field__label">Party Name</span>
                  <span className="ord-field__value">{viewRow.client || '—'}</span>
                </div>
                <div className="ord-field">
                  <span className="ord-field__label">Placed By</span>
                  <span className="ord-field__value">{viewRow.salesman || '—'}</span>
                </div>
                {(order?.distance_meters ?? order?.distance_at_checkout) != null && (
                  <div className="ord-field">
                    <span className="ord-field__label">Distance at checkout</span>
                    <span className="ord-field__value">{Math.round(Number(order?.distance_meters ?? order?.distance_at_checkout))} m</span>
                  </div>
                )}
                <div className="ord-field">
                  <span className="ord-field__label">Order Date</span>
                  <span className="ord-field__value">{orderDate}</span>
                </div>
                <div className="ord-field">
                  <span className="ord-field__label">Status</span>
                  <span>
                    <StatusBadge status={String(viewRow.status).toLowerCase().replace(/\s+/g, '-')}>{viewRow.status}</StatusBadge>
                  </span>
                </div>
                <div className="ord-field">
                  <span className="ord-field__label">Total Value</span>
                  <span className="ord-field__value ord-field__value--strong">{viewRow.value || '—'}</span>
                </div>
              </div>

              {!canEditOrder && (
                <p className="ord-view__lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" /></svg><span>Only admin and order managers can edit or cancel this order.</span></p>
              )}

              {viewRow.clientAddress && (
                <div>
                  <h5 className="ord-view__section-title">Shipping Address</h5>
                  <div className="ord-notes">{viewRow.clientAddress}</div>
                </div>
              )}

              {viewRow.clientBillingAddress && viewRow.clientBillingAddress !== viewRow.clientAddress && (
                <div>
                  <h5 className="ord-view__section-title">Billing Address</h5>
                  <div className="ord-notes">{viewRow.clientBillingAddress}</div>
                </div>
              )}

              <div>
                <h5 className="ord-view__section-title">Order Items</h5>
                <div className="ui-table__scroll">
                  <table className="ord-items">
                    <thead>
                      <tr>
                        <th className="w-[40px]">#</th>
                        <th>Product</th>
                        <th className="ta-r w-[60px]">Qty</th>
                        <th className="ta-r w-[90px]">Price</th>
                        <th className="ta-r w-[104px]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewItemsLoading ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af' }}>Loading items…</td></tr>
                      ) : viewItems.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af' }}>No items</td></tr>
                      ) : (
                        viewItems.map((item, i) => (
                          <tr key={i}>
                            <td style={{ color: '#6b7280' }}>{i + 1}</td>
                            <td className="font-medium">{item._name}</td>
                            <td className="ta-r">{item.quantity}</td>
                            <td className="ta-r">₹{Number(item.price || 0).toLocaleString('en-IN')}</td>
                            <td className="ta-r font-medium">₹{Number(item._subtotal || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {viewItems.length > 0 && (
                      <tfoot>
                        {Number(order?.discount_total) > 0 && (
                          <>
                            <tr>
                              <td colSpan={4} className="ta-r">Subtotal</td>
                              <td className="ta-r">₹{Number(order.subtotal || 0).toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                              <td colSpan={4} className="ta-r">{order.applied_offer?.title || 'Discount'}</td>
                              <td className="ta-r">− ₹{Number(order.discount_total).toLocaleString('en-IN')}</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td colSpan={4} className="ta-r">Total</td>
                          <td className="ta-r">{viewRow.value}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {order?.order_notes && (
                <div>
                  <h5 className="ord-view__section-title">Notes</h5>
                  <div className="ord-notes">{order.order_notes}</div>
                </div>
              )}
            </div>
          );
        })()}
      </AsidePanel>

      {/* Edit Order Status Modal */}
      <AsidePanel open={!!editRow} onClose={closeEditPanel} title="Edit Order Status" footer={(
        <>
          <Button variant="secondary" onClick={closeEditPanel} disabled={loading}>Cancel</Button>
          <Button
            onClick={() => {
              if (editStatus && editRow) {
                handleUpdateStatus(editRow, editStatus);
              }
            }}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </>
      )}>
        <div className="ui-form">
          <div className="form-group">
            <label className="ui-label">Order ID</label>
            <input className="ui-input" value={editRow?.orderId || ''} disabled />
          </div>
          <div className="form-group">
            <label className="ui-label">Client</label>
            <input className="ui-input" value={editRow?.client || ''} disabled />
          </div>
          <div className="form-group">
            <label className="ui-label">Product</label>
            <input className="ui-input" value={editRow?.product || ''} disabled />
          </div>
          <div className="form-group">
            <label className="ui-label">Quantity</label>
            <input type="number" className="ui-input" value={editRow?.qty || ''} disabled />
          </div>
          <div className="form-group">
            <label className="ui-label">Status</label>
            <DropdownSelector
              options={Object.keys(UI_TO_API_STATUS).map(label => ({ value: label, label }))}
              value={editStatus}
              onChange={(value) => setEditStatus(value)}
              placeholder="Select status"
            />
          </div>

          {/* Dispatch details — required by the backend when dispatching or
              partially dispatching an order. */}
          {DISPATCH_STATUSES.includes(UI_TO_API_STATUS[editStatus]) && (
            <>
              <div className="form-group">
                <label className="ui-label">Courier Name *</label>
                <input
                  className="ui-input"
                  placeholder="e.g., Blue Dart, DTDC"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="ui-label">Courier Tracking Number *</label>
                <input
                  className="ui-input"
                  placeholder="Enter tracking number"
                  value={courierTracking}
                  onChange={(e) => setCourierTracking(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Partial dispatch also needs the dispatched quantity. */}
          {UI_TO_API_STATUS[editStatus] === 'partially_dispatched' && (
            <div className="form-group">
              <label className="ui-label">Partial Dispatch Quantity *</label>
              <input
                type="number"
                min="1"
                max={editRow?.qty || undefined}
                className="ui-input"
                placeholder={`How many of ${editRow?.qty || 0} are being dispatched`}
                value={partialQty}
                onChange={(e) => setPartialQty(e.target.value)}
              />
            </div>
          )}
        </div>
      </AsidePanel>
    </div>
  );
};

export default DashboardOrders;

