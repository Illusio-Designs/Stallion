import React, { useMemo, useState, useEffect } from 'react';
import Skeleton from '../components/ui/Skeleton';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  getOrdersForRole,
  updateOrderStatus,
  dispatchOrder,
  returnOrderTrays,
  completeOrder,
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
import '../styles/redesign-n-orders.css';

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
const COURIER_SUGGESTIONS = ['Blue Dart', 'DTDC', 'Delhivery', 'India Post', 'Professional Couriers', 'Gati'];
const CANCEL_REASONS = ['Party asked to cancel', 'Stock not available', 'Wrong order', 'Other'];
const OFFICE_STATUS_TITLE = {
  pending: 'Pending',
  processed: 'Processing',
  hold_by_tray: 'Hold by sample',
  partially_dispatched: 'Partially dispatch',
  dispatched: 'Dispatch',
  completed: 'Completed',
  cancelled: 'Cancel',
};

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${fmtDate(v)}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

// Piece counts for an order. The server sends total/tray/held/shipped/ready;
// older orders without them are derived from the items and the status.
const getPieceCounts = (order) => {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const itemsTotal = items.reduce((sum, it) => sum + toInt(it?.quantity), 0);
  const total = toInt(order?.total_qty) || itemsTotal;
  const status = String(order?.order_status || '').toLowerCase();
  const shipments = Array.isArray(order?.shipments) ? order.shipments : [];
  let shipped = order?.shipped_qty != null ? toInt(order.shipped_qty) : shipments.reduce((sum, sh) => sum + toInt(sh?.qty), 0);
  if (order?.shipped_qty == null && !shipments.length && (status === 'dispatched' || status === 'completed')) shipped = total;
  const held = order?.held_qty != null ? toInt(order.held_qty) : 0;
  const ready = order?.ready_qty != null
    ? toInt(order.ready_qty)
    : (status === 'processed' || status === 'partially_dispatched' ? Math.max(total - shipped - held, 0) : 0);
  const cancelled = status === 'cancelled' ? Math.max(total - shipped, 0) : 0;
  return { total, shipped, ready: status === 'cancelled' ? 0 : ready, held: status === 'cancelled' ? 0 : held, cancelled, trayQty: toInt(order?.tray_qty) };
};

const getShipments = (order) => {
  const list = Array.isArray(order?.shipments) ? order.shipments : [];
  if (list.length) return list;
  if (order?.courier_name || order?.courier_tracking_number) {
    return [{
      shipment_id: 'legacy',
      courier_name: order.courier_name,
      tracking_number: order.courier_tracking_number,
      qty: null,
      shipped_at: order.dispatched_at || null,
    }];
  }
  return [];
};

const DashboardOrders = () => {
  const confirm = useConfirm();
  const [viewRow, setViewRow] = useState(null);
  const [dispatchCourier, setDispatchCourier] = useState('');
  const [dispatchTracking, setDispatchTracking] = useState('');
  const [dispatchQty, setDispatchQty] = useState('');
  const [dispatchErrors, setDispatchErrors] = useState({});
  const [cancelChoice, setCancelChoice] = useState('');
  const [cancelOther, setCancelOther] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [busyAction, setBusyAction] = useState(''); // '' | process | dispatch | trays | complete | cancel
  const [actionError, setActionError] = useState('');
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
  // The tray manager can also tell the order that the sample trays came back.
  const canReturnTrays = useMemo(
    () => getUserRoles().some((r) => ['admin', 'order_manager', 'tray_manager'].includes(r)),
    []
  );
  // Changing an order's status is for admin and order manager only (the server
  // answers "Access denied" to everyone else), so only they get the Edit button.
  const canEditOrder = useMemo(
    () => getUserRoles().some((r) => ['admin', 'order_manager'].includes(r)),
    []
  );
  
  const viewOrderId = viewRow?.originalOrder?.order_id;
  const viewOrderQtyKey = `${viewRow?.originalOrder?.order_status}:${viewRow?.originalOrder?.ready_qty}`;
  useEffect(() => {
    setDispatchCourier('');
    setDispatchTracking('');
    setDispatchErrors({});
    setCancelChoice('');
    setCancelOther('');
    setCancelError('');
    setReceivedBy('');
    setActionError('');
    const ready = toInt(viewRow?.originalOrder?.ready_qty);
    setDispatchQty(ready ? String(ready) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOrderId, viewOrderQtyKey]);

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

  // Merge the order the server returned into the open panel, then refresh the list.
  const applyUpdated = (updated, fallbackStatus) => {
    const next = updated && typeof updated === 'object' ? (updated.data && updated.data.order_id ? updated.data : updated) : {};
    setViewRow((cur) => {
      if (!cur) return cur;
      const merged = { ...cur.originalOrder, ...next };
      if (!next.order_status && fallbackStatus) merged.order_status = fallbackStatus;
      return { ...cur, status: mapApiStatusToUI(merged.order_status), originalOrder: merged };
    });
    fetchOrders(true);
  };

  const errMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

  // Run one order action with a busy flag, an inline error and a refresh.
  const runAction = async (key, fn, okTitle, okText, fallbackStatus) => {
    if (busyAction) return;
    setBusyAction(key);
    setActionError('');
    try {
      const updated = await fn();
      showSuccess(okTitle, null, okTitle, okText);
      applyUpdated(updated, fallbackStatus);
      return true;
    } catch (err) {
      const message = errMessage(err, 'Could not update this order');
      setActionError(message);
      showError(message, null, 'Order not updated', message);
      return false;
    } finally {
      setBusyAction('');
    }
  };

  const orderIdOf = (row) => row?.originalOrder?.order_id || row?.originalOrder?.id;

  const handleProcess = async (row) => {
    const orderId = orderIdOf(row);
    if (!orderId) { showError('Order ID not found'); return; }
    if (!(await confirm({
      title: 'Process order',
      message: 'Start processing this order? Pieces held by sample trays stay held until the trays are returned.',
      confirmLabel: 'Process order',
    }))) return;
    await runAction('process', () => updateOrderStatus(orderId, { order_status: 'processed' }), 'Order processed', `${row.orderId || 'Order'} is now processing.`, 'processed');
  };

  const handleCancel = async (row) => {
    const orderId = orderIdOf(row);
    if (!orderId) { showError('Order ID not found'); return; }
    if (!cancelChoice) { setCancelError('Choose a reason before cancelling.'); return; }
    const reason = cancelChoice === 'Other' ? cancelOther.trim() : cancelChoice;
    if (reason.length < 3 || reason.length > 500) {
      setCancelError(cancelChoice === 'Other' ? 'Write the reason in 3 to 500 characters.' : 'Choose a reason before cancelling.');
      return;
    }
    setCancelError('');
    if (!(await confirm({
      title: 'Cancel order',
      message: 'Cancel this order? Stock is returned and this cannot be undone.',
      confirmLabel: 'Cancel order',
      danger: true,
    }))) return;
    await runAction('cancel', () => updateOrderStatus(orderId, { order_status: 'cancelled', cancel_reason: reason }), 'Order cancelled', `${row.orderId || 'Order'} was cancelled.`, 'cancelled');
  };

  // Dispatch the ready pieces: courier + tracking + how many pieces go in this shipment.
  const handleDispatch = async (row) => {
    const orderId = orderIdOf(row);
    if (!orderId) return;
    const { ready, held } = getPieceCounts(row.originalOrder);
    const name = dispatchCourier.trim();
    const tracking = dispatchTracking.trim();
    const qtyText = String(dispatchQty).trim();
    const qty = Number(qtyText);
    const errs = {};
    if (!name) errs.courier = 'Enter the courier name.';
    if (!tracking) errs.tracking = 'Enter the tracking number.';
    if (!/^\d+$/.test(qtyText) || qty < 1) errs.qty = 'Pieces to send must be a whole number, 1 or more.';
    else if (qty > ready) errs.qty = held > 0
      ? `Only ${ready} pieces are ready. The other ${held} are held by sample tray.`
      : `Only ${ready} pieces are ready to send.`;
    setDispatchErrors(errs);
    if (Object.keys(errs).length) return;
    const ok = await runAction('dispatch', () => dispatchOrder(orderId, { courier_name: name, courier_tracking_number: tracking, qty }), 'Shipment dispatched', `${qty} pieces sent with ${name}.`);
    if (ok) { setDispatchCourier(''); setDispatchTracking(''); }
  };

  const handleTraysReturned = async (row) => {
    const orderId = orderIdOf(row);
    if (!orderId) return;
    const { held } = getPieceCounts(row.originalOrder);
    await runAction('trays', () => returnOrderTrays(orderId), 'Trays returned', `${held} pieces are now ready to send.`);
  };

  const handleComplete = async (row) => {
    const orderId = orderIdOf(row);
    if (!orderId) return;
    const ok = await runAction('complete', () => completeOrder(orderId, { received_by: receivedBy }), 'Order completed', `${row.orderId || 'Order'} is completed.`, 'completed');
    if (ok) setReceivedBy('');
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
        onEdit={(canEditOrder || canReturnTrays) ? () => setViewRow(row) : undefined}
        onDownload={() => handleDownload(row)}
        // Delete is admin-only (the backend also enforces canManageOrders).
      />
    ) },
  ]), [isAdmin, canEditOrder, canReturnTrays]);

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
          <Button onClick={() => setViewRow(null)}>Close</Button>
        </>
      )}>
        {viewRow && (() => {
          const order = viewRow.originalOrder;
          const rawDate = order?.order_date || order?.created_at;
          const orderDate = rawDate
            ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
          const apiStatus = String(order?.order_status || 'pending').toLowerCase();
          const counts = getPieceCounts(order);
          const shipments = getShipments(order);
          const busy = !!busyAction;
          const cancellable = canEditOrder && ['pending', 'processed', 'hold_by_tray', 'partially_dispatched', 'dispatched'].includes(apiStatus);
          const canCancel = cancellable && counts.shipped === 0;
          const shippedBlocksCancel = cancellable && counts.shipped > 0;
          const dispatchable = canEditOrder && ['processed', 'partially_dispatched'].includes(apiStatus);
          const field = (label, value) => (value ? <div className="ordn-fl__row" key={label}><dt>{label}</dt><dd>{value}</dd></div> : null);
          const shipmentList = shipments.length ? (
            <ul className="ordn-ship">
              {shipments.map((sh, n) => (
                <li key={sh.shipment_id || n}>
                  <b>#{n + 1}{sh.qty != null ? ` · ${sh.qty} pcs` : ''}</b>
                  <span>{[sh.courier_name, sh.tracking_number].filter(Boolean).join(' · ') || '—'}</span>
                  {sh.shipped_at && <small>{fmtDate(sh.shipped_at)}</small>}
                </li>
              ))}
            </ul>
          ) : null;
          const sentLabel = `${counts.shipped} of ${counts.total} pieces`;
          const waiting = counts.ready + counts.held;
          const fieldsBody = (() => {
            if (apiStatus === 'pending') return [
              field('Pieces', counts.total ? `${counts.total} in total` : ''),
              field('Stock source', counts.trayQty ? `${Math.max(counts.total - counts.trayQty, 0)} warehouse + ${counts.trayQty} sample trays` : (counts.total ? `${counts.total} warehouse` : '')),
              field('Placed', fmtDateTime(order?.created_at || order?.order_date)),
            ];
            if (apiStatus === 'processed' || apiStatus === 'hold_by_tray') return [
              field('Processed', fmtDateTime(order?.processed_at)),
              field('Ready to send', `${counts.ready} pieces`),
              field('Held by sample tray', counts.held ? `${counts.held} pieces` : (order?.tray_released_at ? `Released ${fmtDate(order.tray_released_at)}` : 'none')),
              field('Trays returned', fmtDate(order?.tray_released_at)),
            ];
            if (apiStatus === 'partially_dispatched') return [
              field('Shipments', shipmentList),
              field('Sent so far', sentLabel),
              field('Still waiting', waiting ? `${waiting} pieces${counts.held ? ' (' + counts.held + ' held by sample tray)' : ' (ready to send)'}` : ''),
              field('Trays returned', fmtDate(order?.tray_released_at)),
            ];
            if (apiStatus === 'dispatched') return [
              field('Shipments', shipmentList),
              field('Sent', sentLabel),
              field('Dispatched', fmtDateTime(order?.dispatched_at)),
            ];
            if (apiStatus === 'completed') return [
              field('Shipments', shipmentList),
              field('Delivered', fmtDateTime(order?.delivered_at)),
              field('Received by', order?.received_by),
            ];
            return [
              field('Reason', order?.cancel_reason),
              field('Cancelled', fmtDateTime(order?.cancelled_at)),
              field('Returned to stock', counts.cancelled ? `${counts.cancelled} pieces` : ''),
              field('Already shipped', counts.shipped ? `${counts.shipped} pieces stay with the party` : 'none'),
            ];
          })();
          const seg = (cls, n, label) => (n > 0 ? <div className={`ordn-seg ordn-seg--${cls}`} style={{ flex: `${n} 1 0` }} title={`${n} ${label}`}>{n}</div> : null);
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
                {order?.distance_m != null && (
                  <div className="ord-field">
                    <span className="ord-field__label">Distance at checkout</span>
                    <span className="ord-field__value">{Number(order.distance_m) >= 1000 ? `${(Number(order.distance_m) / 1000).toFixed(1)} km` : `${Math.round(Number(order.distance_m))} m`}</span>
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

              {counts.total > 0 && (
                <div className="ordn-flow">
                  <div className="ordn-bar" role="img" aria-label={`Pieces: ${counts.shipped} sent, ${counts.ready} ready, ${counts.held} held by sample tray${counts.cancelled ? `, ${counts.cancelled} cancelled` : ''}`}>
                    {seg('sent', counts.shipped, 'sent')}
                    {seg('ready', counts.ready, 'ready to send')}
                    {seg('held', counts.held, 'held by sample tray')}
                    {seg('canc', counts.cancelled, 'cancelled')}
                  </div>
                  <div className="ordn-legend">
                    <span><i className="ordn-dot ordn-dot--sent" />Sent {counts.shipped}</span>
                    <span><i className="ordn-dot ordn-dot--ready" />Ready to send {counts.ready}</span>
                    <span><i className="ordn-dot ordn-dot--held" />Held by sample tray {counts.held}</span>
                    {counts.cancelled > 0 && <span><i className="ordn-dot ordn-dot--canc" />Cancelled {counts.cancelled}</span>}
                  </div>
                </div>
              )}

              <div className="ordn-fields">
                <h5 className="ord-view__section-title">Fields in {OFFICE_STATUS_TITLE[apiStatus] || viewRow.status}</h5>
                <dl className="ordn-fl">{fieldsBody}</dl>
              </div>

              {actionError && <p className="ordn-dispatch__err" role="alert">{actionError}</p>}

              {canEditOrder && apiStatus === 'pending' && (
                <div className="ordn-actions">
                  <Button onClick={() => handleProcess(viewRow)} disabled={busy}>{busyAction === 'process' ? 'Processing…' : 'Process order'}</Button>
                </div>
              )}

              {dispatchable && counts.ready > 0 && (
                <form className="ordn-dispatch" noValidate onSubmit={(e) => { e.preventDefault(); handleDispatch(viewRow); }}>
                  <h5 className="ord-view__section-title">Send ready pieces</h5>
                  <div className="ordn-dispatch__grid ordn-dispatch__grid--3">
                    <label className="ordn-dispatch__field">
                      <span className="ui-label">Courier</span>
                      <input
                        className="ui-input"
                        list="ordn-couriers"
                        placeholder="e.g., Blue Dart"
                        value={dispatchCourier}
                        maxLength={255}
                        disabled={busy}
                        aria-invalid={!!dispatchErrors.courier}
                        onChange={(e) => { setDispatchCourier(e.target.value); setDispatchErrors((x) => ({ ...x, courier: undefined })); setActionError(''); }}
                      />
                      <datalist id="ordn-couriers">
                        {COURIER_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
                      </datalist>
                      {dispatchErrors.courier && <span className="ordn-dispatch__err" role="alert">{dispatchErrors.courier}</span>}
                    </label>
                    <label className="ordn-dispatch__field">
                      <span className="ui-label">Tracking number</span>
                      <input
                        className="ui-input"
                        placeholder="Enter the number"
                        value={dispatchTracking}
                        maxLength={255}
                        disabled={busy}
                        aria-invalid={!!dispatchErrors.tracking}
                        onChange={(e) => { setDispatchTracking(e.target.value); setDispatchErrors((x) => ({ ...x, tracking: undefined })); setActionError(''); }}
                      />
                      {dispatchErrors.tracking && <span className="ordn-dispatch__err" role="alert">{dispatchErrors.tracking}</span>}
                    </label>
                    <label className="ordn-dispatch__field">
                      <span className="ui-label">Pieces to send</span>
                      <input
                        className="ui-input"
                        type="text"
                        inputMode="numeric"
                        value={dispatchQty}
                        disabled={busy}
                        aria-invalid={!!dispatchErrors.qty}
                        onChange={(e) => { setDispatchQty(e.target.value); setDispatchErrors((x) => ({ ...x, qty: undefined })); setActionError(''); }}
                      />
                      {dispatchErrors.qty && <span className="ordn-dispatch__err" role="alert">{dispatchErrors.qty}</span>}
                    </label>
                  </div>
                  <Button type="submit" variant="secondary" disabled={busy}>{busyAction === 'dispatch' ? 'Dispatching…' : 'Dispatch ready pieces'}</Button>
                </form>
              )}

              {canReturnTrays && counts.held > 0 && !['cancelled', 'completed'].includes(apiStatus) && (
                <div className="ordn-notice" role="status">
                  <b>{counts.held} pieces are held by sample tray.</b>
                  <span>They can only be sent after the trays are returned.</span>
                  <Button variant="secondary" onClick={() => handleTraysReturned(viewRow)} disabled={busy}>
                    {busyAction === 'trays' ? 'Saving…' : `Trays returned the ${counts.held} pieces`}
                  </Button>
                </div>
              )}

              {canEditOrder && apiStatus === 'dispatched' && (
                <div className="ordn-dispatch">
                  <h5 className="ord-view__section-title">Mark completed</h5>
                  <label className="ordn-dispatch__field">
                    <span className="ui-label">Received by (optional)</span>
                    <input className="ui-input" placeholder="Name of the person who received it" value={receivedBy} maxLength={255} disabled={busy} onChange={(e) => setReceivedBy(e.target.value)} />
                  </label>
                  <Button onClick={() => handleComplete(viewRow)} disabled={busy}>{busyAction === 'complete' ? 'Saving…' : 'Mark completed'}</Button>
                </div>
              )}

              {apiStatus === 'completed' && <p className="ordn-note">This order is closed. No further changes.</p>}
              {apiStatus === 'cancelled' && <p className="ordn-note">A cancelled order cannot be reopened. Place a new order instead.</p>}

              {shippedBlocksCancel && (
                <p className="ordn-note">Some pieces were already sent, so this order cannot be cancelled. Complete it instead.</p>
              )}

              {canCancel && (
                <div className="ordn-dispatch ordn-cancel">
                  <h5 className="ord-view__section-title">Cancel this order</h5>
                  <label className="ordn-dispatch__field">
                    <span className="ui-label">Reason (required)</span>
                    <select
                      className="ui-input"
                      value={cancelChoice}
                      disabled={busy}
                      aria-invalid={!!cancelError}
                      onChange={(e) => { setCancelChoice(e.target.value); setCancelError(''); }}
                    >
                      <option value="">Choose a reason</option>
                      {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  {cancelChoice === 'Other' && (
                    <label className="ordn-dispatch__field">
                      <span className="ui-label">Write the reason</span>
                      <input className="ui-input" value={cancelOther} maxLength={500} disabled={busy} onChange={(e) => { setCancelOther(e.target.value); setCancelError(''); }} />
                    </label>
                  )}
                  {cancelError && <span className="ordn-dispatch__err" role="alert">{cancelError}</span>}
                  <Button variant="secondary" onClick={() => handleCancel(viewRow)} disabled={busy || !cancelChoice}>{busyAction === 'cancel' ? 'Cancelling…' : 'Cancel order'}</Button>
                </div>
              )}

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
    </div>
  );
};

export default DashboardOrders;

