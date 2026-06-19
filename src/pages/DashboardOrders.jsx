import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Skeleton from '../components/ui/Skeleton';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import {
  getOrdersForRole,
  createOrder,
  updateOrderStatus, 
  deleteOrder,
  getParties,
  getDistributors,
  getSalesmen,
  getEvents,
  getProducts,
  getProductById,
  getSalesmanById,
  getCountries
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import { getUserRole, getUser } from '../services/authService';
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

const DashboardOrders = () => {
  const [editRow, setEditRow] = useState(null);
  const [editStatus, setEditStatus] = useState('PENDING');
  const [viewRow, setViewRow] = useState(null);
  const [viewItems, setViewItems] = useState([]);
  const [viewItemsLoading, setViewItemsLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [dateFrom, setDateFrom] = useState(null); // 'YYYY-MM-DD' or null
  const [dateTo, setDateTo] = useState(null);     // 'YYYY-MM-DD' or null
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [partyNamesMap, setPartyNamesMap] = useState({}); // Map of party_id -> party_name
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
  
  // Dropdown data
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [allParties, setAllParties] = useState([]); // Store all parties fetched from API
  const [parties, setParties] = useState([]); // Filtered parties to display
  const [distributors, setDistributors] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Create order form data
  // Auto-set order_type based on role
  // Distributor can select order type, but defaults to distributor_order
  const getInitialOrderType = () => {
    if (isParty) return 'party_order';
    // Distributor can select, but default is distributor_order
    if (isDistributor) return 'distributor_order';
    return '';
  };

  const [createFormData, setCreateFormData] = useState({
    order_type: getInitialOrderType(),
    party_id: '',
    distributor_id: '',
    salesman_id: '',
    event_id: '',
    order_items: [{ product_id: '', quantity: 1, price: 0 }],
    order_notes: ''
  });

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
      
      // Fetch party names for orders that don't have party_name
      const uniquePartyIds = [...new Set(allOrders
        .filter(order => order.party_id && !order.party?.party_name && !order.party_name)
        .map(order => order.party_id)
      )];
      
      if (uniquePartyIds.length > 0) {
        try {
          // One call for all parties instead of one getPartyById per order (N+1)
          const allParties = await getParties();
          const newPartyNamesMap = { ...partyNamesMap };
          (allParties || []).forEach((p) => {
            const id = p.id || p.party_id;
            if (id) newPartyNamesMap[id] = p.party_name || p.name || 'N/A';
          });
          setPartyNamesMap(newPartyNamesMap);
        } catch (err) {
          console.error('Failed to fetch party names:', err);
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

  // Load create-order form data (countries + products) only when the create
  // modal opens - not on page load, since the listing doesn't need them.
  useEffect(() => {
    if (createModalOpen && countries.length === 0) {
      fetchInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createModalOpen]);

  // Fetch initial data for dropdowns
  const fetchInitialData = async () => {
    try {
      const [countriesData, productsData] = await Promise.all([
        getCountries(),
        getProducts()
      ]);
      setCountries(countriesData || []);
      const productList = Array.isArray(productsData) ? productsData : (productsData?.data || []);
      if (productList.length > 0) setProducts(productList);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  // Fetch events only when event_order is selected
  const fetchEvents = useCallback(async () => {
    try {
      const eventsData = await getEvents();
      setEvents(eventsData || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setEvents([]);
    }
  }, []);

  // Fetch events when event_order is selected
  useEffect(() => {
    if (createFormData.order_type === 'event_order' && events.length === 0) {
      fetchEvents();
    }
  }, [createFormData.order_type, events.length, fetchEvents]);

  // Filter parties based on salesman zone and order type
  const filterPartiesByZone = useCallback((partiesList, orderType) => {
    if (!isSalesman || !user?.zone_preference) {
      // Not a salesman or no zone preference, show all parties
      setParties(partiesList);
      return;
    }

    const salesmanZone = String(user.zone_preference).trim();
    
    // For event_order, show all parties regardless of zone
    if (orderType === 'event_order') {
      setParties(partiesList);
      return;
    }

    // For visit_order and whatsapp_order, filter by zone
    if (orderType === 'visit_order' || orderType === 'whatsapp_order') {
      const filteredParties = partiesList.filter(party => {
        const partyZoneId = party.zone_id || party.zoneId;
        if (!partyZoneId) return false;
        return String(partyZoneId).trim() === salesmanZone;
      });
      console.log('[filterPartiesByZone] Filtered parties for zone:', salesmanZone, 'Order type:', orderType, 'Total:', partiesList.length, 'Filtered:', filteredParties.length);
      setParties(filteredParties);
      return;
    }

    // For other order types, show all parties
    setParties(partiesList);
  }, [isSalesman, user]);

  // Fetch parties when country is selected
  const fetchPartiesForCountry = useCallback(async (countryId) => {
    if (!countryId) {
      setAllParties([]);
      setParties([]);
      return;
    }
    
    try {
      const cleanCountryId = String(countryId).trim();
      if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
        console.error('[fetchPartiesForCountry] Invalid country ID:', countryId);
        setAllParties([]);
        setParties([]);
        return;
      }
      
      console.log('[fetchPartiesForCountry] Fetching parties for country:', cleanCountryId);
      const partiesData = await getParties(cleanCountryId);
      console.log('[fetchPartiesForCountry] Received', partiesData?.length || 0, 'parties');
      setAllParties(partiesData || []);
      // Apply filtering based on order type and salesman zone
      filterPartiesByZone(partiesData || [], createFormData.order_type);
    } catch (err) {
      console.error('Failed to fetch parties:', err);
      setAllParties([]);
      setParties([]);
    }
  }, [filterPartiesByZone, createFormData.order_type]);

  // Fetch distributors when country is selected
  const fetchDistributorsForCountry = useCallback(async (countryId) => {
    if (!countryId) {
      setDistributors([]);
      return;
    }
    
    try {
      const cleanCountryId = String(countryId).trim();
      if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
        console.error('[fetchDistributorsForCountry] Invalid country ID:', countryId);
        setDistributors([]);
        return;
      }
      
      console.log('[fetchDistributorsForCountry] Fetching distributors for country:', cleanCountryId);
      const distributorsData = await getDistributors(cleanCountryId);
      console.log('[fetchDistributorsForCountry] Received', distributorsData?.length || 0, 'distributors');
      setDistributors(distributorsData || []);
    } catch (err) {
      console.error('Failed to fetch distributors:', err);
      setDistributors([]);
    }
  }, []);

  // Fetch salesmen when country is selected
  const fetchSalesmenForCountry = useCallback(async (countryId) => {
    if (!countryId) {
      setSalesmen([]);
      return;
    }
    
    try {
      const cleanCountryId = String(countryId).trim();
      if (!cleanCountryId || cleanCountryId === 'undefined' || cleanCountryId === 'null') {
        console.error('[fetchSalesmenForCountry] Invalid country ID:', countryId);
        setSalesmen([]);
        return;
      }
      
      console.log('[fetchSalesmenForCountry] Fetching salesmen for country:', cleanCountryId);
      const salesmenData = await getSalesmen(cleanCountryId);
      console.log('[fetchSalesmenForCountry] Received', salesmenData?.length || 0, 'salesmen');
      setSalesmen(salesmenData || []);
    } catch (err) {
      console.error('Failed to fetch salesmen:', err);
      setSalesmen([]);
    }
  }, []);

  // Apply filtering when order type changes (for salesman)
  useEffect(() => {
    if (isSalesman && allParties.length > 0) {
      filterPartiesByZone(allParties, createFormData.order_type);
    }
  }, [createFormData.order_type, isSalesman, allParties, filterPartiesByZone]);

  // Fetch parties when country is selected
  useEffect(() => {
    if (selectedCountry) {
      fetchPartiesForCountry(selectedCountry);
    } else {
      setAllParties([]);
      setParties([]);
    }
  }, [selectedCountry, fetchPartiesForCountry]);

  // Fetch distributors when country is selected
  useEffect(() => {
    if (selectedCountry) {
      fetchDistributorsForCountry(selectedCountry);
    } else {
      setDistributors([]);
    }
  }, [selectedCountry, fetchDistributorsForCountry]);

  // Fetch salesmen when country is selected
  useEffect(() => {
    if (selectedCountry) {
      fetchSalesmenForCountry(selectedCountry);
    } else {
      setSalesmen([]);
    }
  }, [selectedCountry, fetchSalesmenForCountry]);

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
      products.find(p => String(p.product_id || p.id) === String(it.product_id))?.model_no ||
      products.find(p => String(p.product_id || p.id) === String(it.product_id))?.product_name ||
      null;

    let cancelled = false;
    (async () => {
      const unresolved = [...new Set(
        items.filter(it => !nameFrom(it, {})).map(it => String(it.product_id)).filter(Boolean)
      )];

      const lookup = {};
      if (unresolved.length > 0) {
        setViewItemsLoading(true);
        await Promise.all(unresolved.map(async (pid) => {
          try {
            const p = await getProductById(pid);
            if (p) lookup[pid] = p.model_no || p.product_name || p.name;
          } catch { /* leave unresolved */ }
        }));
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
  }, [viewRow, products]);

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
        salesman: salesmanLabel,
        date: orderDate,
        qty: totalQuantity,
        status: orderStatus,
        value: `₹${totalValue.toLocaleString('en-IN')}`,
        originalOrder: order
      });
    });

    return tableRows;
  }, [orders, partyNamesMap, salesmanNamesMap]);

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

  // Handle update order status
  const handleUpdateStatus = async (row, newStatus) => {
    try {
      setLoading(true);
      const orderId = row.originalOrder?.order_id || row.originalOrder?.id;
      if (!orderId) {
        showError('Order ID not found');
        return;
      }

      // Map UI status back to API status
      const statusMap = {
        'PENDING': 'pending',
        'PROCESSING': 'processed',
        'HOLD BY TREY': 'hold_by_tray',
        'PARTIALLY DISPATCH': 'partially_dispatched',
        'DISPATCH': 'dispatched',
        'COMPLETED': 'completed',
        'CANCEL': 'cancelled'
      };

      const apiStatus = statusMap[newStatus] || newStatus.toLowerCase();
      await updateOrderStatus(orderId, { order_status: apiStatus });
      showSuccess('Order status updated successfully');
      await fetchOrders();
      setEditRow(null);
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to update order status';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle create order
  const handleCreateOrder = async () => {
    try {
      // Order type validation
      // Admin doesn't need order type
      // Distributor can select or defaults to distributor_order
      // Party auto-sets to party_order
      // Salesman must select order type
      if (!isAdmin && !isDistributor && !isParty && !createFormData.order_type) {
        showError('Order type is required');
        return;
      }
      
      // For distributor, if no order type selected, default to distributor_order
      if (isDistributor && !createFormData.order_type) {
        createFormData.order_type = 'distributor_order';
      }
      if (createFormData.order_items.length === 0 || 
          createFormData.order_items.some(item => !item.product_id || !item.quantity || !item.price)) {
        showError('Please add at least one valid order item');
        return;
      }

      // Validate conditional fields based on order type
      const orderType = createFormData.order_type;
      
      // Skip validation for distributor and party roles (they auto-set their IDs)
      // Salesman auto-sets their ID, but still needs party and distributor for their order types
      if (!isDistributor && !isParty) {
        if (['event_order', 'party_order', 'visit_order', 'whatsapp_order'].includes(orderType) && !createFormData.party_id) {
          showError('Party is required for this order type');
          return;
        }
        if (['event_order', 'party_order', 'distributor_order', 'visit_order', 'whatsapp_order'].includes(orderType) && !createFormData.distributor_id) {
          showError('Distributor is required for this order type');
          return;
        }
        // Salesman ID is auto-set for salesman role, but still validate for other roles
        if (!isSalesman && ['event_order', 'visit_order', 'whatsapp_order'].includes(orderType) && !createFormData.salesman_id) {
          showError('Salesman is required for this order type');
          return;
        }
        if (orderType === 'event_order' && !createFormData.event_id) {
          showError('Event is required for event orders');
          return;
        }
      }

      setLoading(true);
      
      // Prepare order data - order_date is automatically set to current date/time
      const orderData = {
        order_date: new Date().toISOString(),
        order_items: createFormData.order_items.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price)
        }))
      };
      
      // Include order_type
      // For distributor, if not selected, default to distributor_order
      const finalOrderType = createFormData.order_type || (isDistributor ? 'distributor_order' : '');
      if (finalOrderType) {
        orderData.order_type = finalOrderType;
      }

      // Auto-set distributor_id for distributor role
      if (isDistributor && user?.distributor_id) {
        orderData.distributor_id = user.distributor_id;
      } else if (createFormData.distributor_id) {
        orderData.distributor_id = createFormData.distributor_id;
      }

      // Auto-set party_id for party role
      if (isParty && user?.party_id) {
        orderData.party_id = user.party_id;
      } else if (createFormData.party_id) {
        orderData.party_id = createFormData.party_id;
      }

      // Auto-set salesman_id for salesman role
      if (isSalesman && user?.salesman_id) {
        orderData.salesman_id = user.salesman_id;
      } else if (createFormData.salesman_id) {
        orderData.salesman_id = createFormData.salesman_id;
      }
      if (createFormData.event_id) orderData.event_id = createFormData.event_id;
      if (createFormData.order_notes) orderData.order_notes = createFormData.order_notes;

      await createOrder(orderData);
      showSuccess('Order created successfully');
      setCreateModalOpen(false);
      resetCreateForm();
      // Suppress error notification when refreshing after create (in case of temporary "not found")
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
      order_type: getInitialOrderType(),
      party_id: '',
      distributor_id: '',
      salesman_id: '',
      event_id: '',
      order_items: [{ product_id: '', quantity: 1, price: 0 }],
      order_notes: ''
    });
    setSelectedCountry(null);
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

  // Check if field is required based on order type
  const isFieldRequired = (field) => {
    const orderType = createFormData.order_type;
    switch (field) {
      case 'party_id':
        return ['event_order', 'party_order', 'visit_order', 'whatsapp_order'].includes(orderType);
      case 'distributor_id':
        return ['event_order', 'party_order', 'distributor_order', 'visit_order', 'whatsapp_order'].includes(orderType);
      case 'salesman_id':
        return ['event_order', 'visit_order', 'whatsapp_order'].includes(orderType);
      case 'event_id':
        return orderType === 'event_order';
      default:
        return false;
    }
  };

  // Handle download order as a branded PDF
  const handleDownload = async (row) => {
    const order = row.originalOrder;
    const orderItems = parseOrderItems(order?.order_items);

    // Resolve product names: embedded -> loaded products -> by-id lookup (keeps limit 20).
    const nameFrom = (it, lookup) =>
      it.model_no || it.product?.model_no || it.product_name || it.product?.product_name ||
      lookup[String(it.product_id)] ||
      products.find(p => String(p.product_id || p.id) === String(it.product_id))?.model_no ||
      products.find(p => String(p.product_id || p.id) === String(it.product_id))?.product_name || null;

    const unresolved = [...new Set(orderItems.filter(it => !nameFrom(it, {})).map(it => String(it.product_id)).filter(Boolean))];
    const lookup = {};
    await Promise.all(unresolved.map(async (pid) => {
      try { const p = await getProductById(pid); if (p) lookup[pid] = p.model_no || p.product_name || p.name; } catch { /* ignore */ }
    }));

    const items = orderItems.map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return { name: String(nameFrom(it, lookup) || 'Unknown Product'), qty, price, subtotal: qty * price };
    });
    const grandTotal = items.reduce((s, it) => s + it.subtotal, 0) ||
      parseFloat(String(row.value || '').replace(/[^0-9.]/g, '')) || 0;

    const rawDate = order?.order_date || order?.created_at;
    const orderDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const PW = 210;
    const M = 14;            // page margin
    const INK = [26, 27, 35];
    const MUTE = [107, 111, 125];
    const BRAND = [24, 18, 101];
    const LIGHT = [244, 245, 247];

    // ---- Header band ----
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, PW, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('STALLION EYEWEAR LLP', M, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Your Vision. Our Passion.', M, 21);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('ORDER', PW - M, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${row.orderId || ''}`, PW - M, 20, { align: 'right' });

    // ---- Meta grid ----
    let y = 44;
    const metaL = [['Order ID', row.orderId], ['Party Name', row.client], ['Order Type', row.orderType]];
    const metaR = [['Order Date', orderDate], ['Status', row.status], ['Total', money(grandTotal)]];
    const drawMeta = (pairs, lx, vx) => {
      let yy = y;
      pairs.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...MUTE);
        doc.text(String(label).toUpperCase(), lx, yy);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...INK);
        doc.text(String(value || '-'), lx, yy + 5);
        yy += 13;
      });
    };
    drawMeta(metaL, M, M);
    drawMeta(metaR, 112, 112);
    y += metaL.length * 13 + 2;

    // ---- Items table ----
    const colNum = M + 2;
    const colProd = M + 12;
    const colQty = 138;     // right-aligned
    const colPrice = 168;   // right-aligned
    const colAmt = PW - M;  // right-aligned
    const tableW = PW - M * 2;

    // header
    doc.setFillColor(...BRAND);
    doc.rect(M, y, tableW, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('#', colNum, y + 6);
    doc.text('PRODUCT', colProd, y + 6);
    doc.text('QTY', colQty, y + 6, { align: 'right' });
    doc.text('PRICE', colPrice, y + 6, { align: 'right' });
    doc.text('AMOUNT', colAmt, y + 6, { align: 'right' });
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const rowH = 9;
    if (items.length === 0) {
      doc.setTextColor(...MUTE);
      doc.text('No items', colProd, y + 6);
      y += rowH;
    } else {
      items.forEach((it, i) => {
        if (y > 262) { doc.addPage(); y = 20; }
        if (i % 2 === 1) { doc.setFillColor(...LIGHT); doc.rect(M, y, tableW, rowH, 'F'); }
        doc.setTextColor(...INK);
        doc.text(String(i + 1), colNum, y + 6);
        doc.text(doc.splitTextToSize(it.name, 96)[0], colProd, y + 6);
        doc.text(String(it.qty), colQty, y + 6, { align: 'right' });
        doc.text(money(it.price), colPrice, y + 6, { align: 'right' });
        doc.text(money(it.subtotal), colAmt, y + 6, { align: 'right' });
        y += rowH;
      });
    }

    // table border
    doc.setDrawColor(223, 225, 231);
    doc.line(M, y, PW - M, y);

    // ---- Totals ----
    y += 8;
    const boxX = 120;
    doc.setFillColor(...LIGHT);
    doc.rect(boxX, y, PW - M - boxX, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND);
    doc.text('TOTAL', boxX + 4, y + 9);
    doc.text(money(grandTotal), PW - M - 4, y + 9, { align: 'right' });

    // ---- Notes ----
    if (order?.order_notes) {
      y += 24;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...MUTE);
      doc.text('NOTES', M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(String(order.order_notes), tableW), M, y + 6);
    }

    // ---- Footer band ----
    doc.setFillColor(...BRAND);
    doc.rect(0, 287, PW, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for your business  •  Stallion Eyewear LLP', M, 293);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, PW - M, 293, { align: 'right' });

    doc.save(`Order-${row.orderId || 'details'}.pdf`);
  };

  const columns = useMemo(() => ([
    { key: 'orderId', label: 'ORDER ID' },
    { key: 'orderType', label: 'ORDER TYPE' },
    { key: 'client', label: 'PARTY NAME' },
    { key: 'salesman', label: 'SALESMAN' },
    { key: 'date', label: 'DATE' },
    { key: 'qty', label: 'QTY' },
    { key: 'status', label: 'STATUS', render: (v) => <StatusBadge status={String(v).toLowerCase().replace(/\s+/g, '-')}>{v}</StatusBadge> },
    { key: 'value', label: 'VALUE' },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions 
        onView={() => setViewRow(row)} 
        onEdit={() => {
          setEditRow(row);
          setEditStatus(row?.status || 'PENDING');
        }} 
        onDownload={() => handleDownload(row)} 
      />
    ) },
  ]), []);

  return (
    <div className="dash-page">
      <div className="dash-container">
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
            {['All', 'Pending', 'Processing', 'Hold by Trey', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'].map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[length:var(--text-base)] font-semibold leading-[var(--leading-snug)] transition-[background,color,box-shadow] duration-[0.12s] ease-out focus-visible:outline-none active:scale-[0.98] ${activeTab === tab ? 'active bg-primary text-text-on-primary' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
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
                <p className="ui-state__desc">Orders you create will show up here. Get started by creating your first order.</p>
                <div className="ui-state__actions">
                  <button className="ui-btn ui-btn--primary" onClick={() => setCreateModalOpen(true)}>Create Order</button>
                </div>
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
        <Button onClick={() => setViewRow(null)}>Close</Button>
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
      <AsidePanel open={!!editRow} onClose={() => {
        setEditRow(null);
        setEditStatus('PENDING');
      }} title="Edit Order Status" footer={(
        <>
          <Button variant="secondary" onClick={() => {
            setEditRow(null);
            setEditStatus('PENDING');
          }} disabled={loading}>Cancel</Button>
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
              options={[
                { value: 'PENDING', label: 'PENDING' },
                { value: 'PROCESSING', label: 'PROCESSING' },
                { value: 'HOLD BY TREY', label: 'HOLD BY TREY' },
                { value: 'PARTIALLY DISPATCH', label: 'PARTIALLY DISPATCH' },
                { value: 'DISPATCH', label: 'DISPATCH' },
                { value: 'COMPLETED', label: 'COMPLETED' },
                { value: 'CANCEL', label: 'CANCEL' }
              ]}
              value={editStatus}
              onChange={(value) => setEditStatus(value)}
              placeholder="Select status"
            />
          </div>
        </div>
      </AsidePanel>

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
        <div className="ui-form">
          {/* Order Type - Hidden for admin and party roles */}
          {/* Salesman and Distributor can see order type dropdown */}
          {!isAdmin && !isParty && (
            <div className="form-group">
              <label className="ui-label">
                Order Type 
                {!isDistributor && <span className="text-[red]">*</span>}
                {isDistributor && <span className="text-[12px] text-[#666]"> (Default: Distributor Order)</span>}
              </label>
              <DropdownSelector
                options={[
                  { value: '', label: 'Select Order Type' },
                  ...(isSalesman ? [
                    { value: 'visit_order', label: 'Visit Order' },
                    { value: 'whatsapp_order', label: 'WhatsApp Order' },
                    { value: 'event_order', label: 'Event Order' }
                  ] : isDistributor ? [
                    { value: 'distributor_order', label: 'Distributor Order' },
                    { value: 'party_order', label: 'Party Order' }
                  ] : [
                    { value: 'event_order', label: 'Event Order' },
                    { value: 'party_order', label: 'Party Order' },
                    { value: 'distributor_order', label: 'Distributor Order' },
                    { value: 'visit_order', label: 'Visit Order' },
                    { value: 'whatsapp_order', label: 'WhatsApp Order' }
                  ])
                ]}
                value={createFormData.order_type || ''}
                onChange={(value) => {
                  const newOrderType = value;
                  setCreateFormData(prev => ({ 
                    ...prev, 
                    order_type: newOrderType,
                    party_id: '',
                    distributor_id: '',
                    salesman_id: '',
                    event_id: ''
                  }));
                  // Re-filter parties when order type changes (for salesman)
                  if (isSalesman && allParties.length > 0) {
                    filterPartiesByZone(allParties, newOrderType);
                  }
                }}
                placeholder="Select Order Type"
                className="ui-dropdown-custom--full-width"
              />
            </div>
          )}

          {/* Country Selection (for fetching parties, distributors, salesmen) */}
          <div className="form-group">
            <label className="ui-label">Country</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select Country' },
                ...countries.map(country => ({
                  value: country.id || country.country_id,
                  label: country.country_name || country.name
                }))
              ]}
              value={selectedCountry || ''}
              onChange={(value) => setSelectedCountry(value || null)}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          </div>

          {/* Party ID - Conditional */}
          {(isFieldRequired('party_id') || createFormData.party_id) && (
            <div className="form-group">
              <label className="ui-label">
                Party {isFieldRequired('party_id') && <span className="text-[red]">*</span>}
              </label>
              <DropdownSelector
                options={[
                  { value: '', label: 'Select Party' },
                  ...(!selectedCountry ? [] : parties.length === 0 ? [] : parties.map(party => ({
                    value: party.id || party.party_id,
                    label: party.party_name
                  })))
                ]}
                value={createFormData.party_id || ''}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, party_id: value || '' }))}
                placeholder={!selectedCountry ? 'Please select a country first' : parties.length === 0 ? 'No parties found for this country' : 'Select Party'}
                disabled={!selectedCountry}
                className="ui-dropdown-custom--full-width"
              />
              {!selectedCountry && (
                <small className="text-[12px] text-[#666]">Please select a country first</small>
              )}
              {selectedCountry && parties.length === 0 && allParties.length > 0 && isSalesman && (createFormData.order_type === 'visit_order' || createFormData.order_type === 'whatsapp_order') && (
                <small className="text-[12px] text-[#666]">No parties found in your zone for this order type</small>
              )}
              {selectedCountry && parties.length === 0 && allParties.length === 0 && (
                <small className="text-[12px] text-[#666]">No parties available for this country</small>
              )}
              {selectedCountry && parties.length > 0 && isSalesman && (createFormData.order_type === 'visit_order' || createFormData.order_type === 'whatsapp_order') && (
                <small className="text-[12px] text-[#666]">Showing parties from your zone only</small>
              )}
              {selectedCountry && parties.length > 0 && isSalesman && createFormData.order_type === 'event_order' && (
                <small className="text-[12px] text-[#666]">Showing all parties for event orders</small>
              )}
            </div>
          )}

          {/* Distributor ID - Conditional */}
          {(isFieldRequired('distributor_id') || createFormData.distributor_id) && (
            <div className="form-group">
              <label className="ui-label">
                Distributor {isFieldRequired('distributor_id') && <span className="text-[red]">*</span>}
              </label>
              <DropdownSelector
                options={[
                  { value: '', label: 'Select Distributor' },
                  ...(!selectedCountry ? [] : distributors.length === 0 ? [] : distributors.map(distributor => ({
                    value: distributor.id || distributor.distributor_id,
                    label: distributor.distributor_name || distributor.name
                  })))
                ]}
                value={createFormData.distributor_id || ''}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, distributor_id: value || '' }))}
                placeholder={!selectedCountry ? 'Please select a country first' : distributors.length === 0 ? 'No distributors found for this country' : 'Select Distributor'}
                disabled={!selectedCountry}
                className="ui-dropdown-custom--full-width"
              />
              {!selectedCountry && (
                <small className="text-[12px] text-[#666]">Please select a country first</small>
              )}
              {selectedCountry && distributors.length === 0 && (
                <small className="text-[12px] text-[#666]">No distributors available for this country</small>
              )}
            </div>
          )}

          {/* Salesman ID - Conditional - Hidden for salesman role (auto-set) */}
          {!isSalesman && (isFieldRequired('salesman_id') || createFormData.salesman_id) && (
            <div className="form-group">
              <label className="ui-label">
                Salesman {isFieldRequired('salesman_id') && <span className="text-[red]">*</span>}
              </label>
              <DropdownSelector
                options={[
                  { value: '', label: 'Select Salesman' },
                  ...(!selectedCountry ? [] : salesmen.length === 0 ? [] : salesmen.map(salesman => ({
                    value: salesman.id || salesman.salesman_id,
                    label: salesman.salesman_name || salesman.name
                  })))
                ]}
                value={createFormData.salesman_id || ''}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, salesman_id: value || '' }))}
                placeholder={!selectedCountry ? 'Please select a country first' : salesmen.length === 0 ? 'No salesmen found for this country' : 'Select Salesman'}
                disabled={!selectedCountry}
                className="ui-dropdown-custom--full-width"
              />
              {!selectedCountry && (
                <small className="text-[12px] text-[#666]">Please select a country first</small>
              )}
              {selectedCountry && salesmen.length === 0 && (
                <small className="text-[12px] text-[#666]">No salesmen available for this country</small>
              )}
            </div>
          )}

          {/* Event ID - Conditional - Only for event_order */}
          {createFormData.order_type === 'event_order' && (
            <div className="form-group">
              <label className="ui-label">
                Event <span className="text-[red]">*</span>
              </label>
              <DropdownSelector
                options={[
                  { value: '', label: 'Select Event' },
                  ...(events.length === 0 ? [] : events.map(event => ({
                    value: event.id || event.event_id,
                    label: `${event.event_name}${event.event_date ? ` (${new Date(event.event_date).toLocaleDateString()})` : ''}`
                  })))
                ]}
                value={createFormData.event_id || ''}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, event_id: value || '' }))}
                placeholder={events.length === 0 ? 'Loading events...' : 'Select Event'}
                className="ui-dropdown-custom--full-width"
              />
            </div>
          )}

          {/* Order Items */}
          <div className="form-group">
            <label className="ui-label">
              Order Items <span className="text-[red]">*</span>
            </label>
            <div className="rounded-lg border border-[#E0E0E0] p-4">
              {createFormData.order_items.map((item, index) => (
                <div key={index} style={{ 
                  marginBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  paddingBottom: index < createFormData.order_items.length - 1 ? '16px' : 0,
                  borderBottom: index < createFormData.order_items.length - 1 ? '1px solid #E0E0E0' : 'none'
                }}>
                  <div className="mb-2 flex items-center justify-between">
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
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-[12px] text-[#666]">Product</label>
                      <DropdownSelector
                        options={[
                          { value: '', label: 'Select Product' },
                          ...products.map(product => ({
                            value: product.id || product.product_id,
                            label: `${product.model_no || product.product_name || product.name}${product.price ? ` - ₹${product.price}` : ''}`
                          }))
                        ]}
                        value={item.product_id || ''}
                        onChange={(value) => handleProductSelect(index, value)}
                        placeholder="Select Product"
                        className="ui-dropdown-custom--full-width"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] text-[#666]">Quantity</label>
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
                      <label className="mb-1 block text-[12px] text-[#666]">Price</label>
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

export default DashboardOrders;

