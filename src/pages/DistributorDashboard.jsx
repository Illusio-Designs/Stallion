import React, { useMemo, useState, useEffect } from 'react';
import Skeleton from '../components/ui/Skeleton';
import '../styles/pages/dashboard.css';
import { getMyOrders, getProducts, getProductById } from '../services/apiService';
import { getUser } from '../services/authService';
import { showError } from '../services/notificationService';
import StatusBadge from '../components/ui/StatusBadge';
import RowActions from '../components/ui/RowActions';

const DistributorDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [productNames, setProductNames] = useState({}); // product_id -> resolved name
  const user = getUser();
  const distributorId = user?.distributor_id || user?.distributorId;

  useEffect(() => {
    fetchOrders();
  }, []);

  // Resolve names for products referenced by the displayed orders but not in the
  // limit-20 products page. Looked up by id on-demand so the list keeps limit 20.
  useEffect(() => {
    const ids = [...new Set(
      orders.slice(0, 10).flatMap(o => {
        let items = [];
        try { items = Array.isArray(o.order_items) ? o.order_items : JSON.parse(o.order_items || '[]'); } catch { items = []; }
        return (Array.isArray(items) ? items : []).map(it => String(it.product_id)).filter(Boolean);
      })
    )].filter(id => !productNames[id] && !products.find(p => String(p.product_id || p.id) === id));
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = {};
      await Promise.all(ids.map(async (pid) => {
        try { const p = await getProductById(pid); if (p) map[pid] = p.model_no || p.product_name || p.name; } catch { /* ignore */ }
      }));
      if (!cancelled && Object.keys(map).length) setProductNames(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, products]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const [allOrders, productsData] = await Promise.all([getMyOrders(), getProducts()]);
      setProducts(Array.isArray(productsData) ? productsData : (productsData?.data || []));
      // Filter orders for this distributor
      const distributorOrders = distributorId 
        ? allOrders.filter(order => 
            (order.distributor_id || order.distributor?.id || order.distributor?.distributor_id) === distributorId ||
            order.order_type === 'distributor_order'
          )
        : allOrders.filter(order => order.order_type === 'distributor_order');
      setOrders(distributorOrders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showError('Could not load orders. Please try again.');
      setError(error?.message || 'Could not load orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        {/* Summary Cards */}
        <div className="dash-row orders-summary grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="dash-card metric orders-card bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle mb-2">Total Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `${summaryStats.totalOrders} Orders`}</div>
          </div>
          <div className="dash-card metric orders-card bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle mb-2">Pending Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle mb-2">Completed Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle mb-2">Total Revenue</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Overview Table */}
        <div className="dash-row grid grid-cols-1 gap-3 sm:gap-4">
          <div className="dash-card bg-surface border border-border rounded-lg shadow-sm p-5" style={{gridColumn:'span 12'}}>
            <h4 className="text-black text-base font-bold" style={{color: '#000000', fontSize: '16px', fontWeight: '700'}}>My Orders</h4>
            <div className="ui-table__scroll">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {['ORDER ID','ORDER TYPE','PARTY NAME','PRODUCT','QTY','STATUS','VALUE','ACTION'].map((h)=> (
                      <th key={h} className="text-left py-[14px] text-xs text-black border-b border-b-[#E0E0E0]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`sk-${i}`}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="py-[14px]">
                            <Skeleton height={16} width={j === 3 ? '60%' : '80%'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : error ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        <div className="ui-state ui-state--error">
                          <div className="ui-state__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          </div>
                          <p className="ui-state__title">Couldn't load orders</p>
                          <p className="ui-state__desc">{error}</p>
                          <button className="ui-btn ui-btn--secondary" onClick={fetchOrders}>Try again</button>
                        </div>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        <div className="ui-state ui-state--empty">
                          <div className="ui-state__icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>
                          </div>
                          <p className="ui-state__title">No orders yet</p>
                          <p className="ui-state__desc">Orders placed for your distribution will appear here once they're created.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.slice(0, 10).map((order, index) => {
                      const orderId = order.order_id || order.id;
                      const orderNumber = order.order_number || `#${orderId?.toString().slice(-6) || 'N/A'}`;
                      // Get party name from order object, try multiple possible field names
                      const partyName = order.party?.party_name || 
                                       order.party_name || 
                                       order.party?.name ||
                                       (order.party_id ? `Party ${order.party_id.slice(0, 8)}...` : 'N/A');
                      const orderStatus = mapApiStatusToUI(order.order_status);
                      
                      // Format order type for display
                      const formatOrderType = (type) => {
                        if (!type) return 'N/A';
                        return type
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      const orderTypeDisplay = formatOrderType(order.order_type);
                      
                      // Parse order_items (can be JSON string or array)
                      let orderItems = [];
                      if (order.order_items) {
                        if (Array.isArray(order.order_items)) {
                          orderItems = order.order_items;
                        } else if (typeof order.order_items === 'string') {
                          try {
                            orderItems = JSON.parse(order.order_items);
                            if (!Array.isArray(orderItems)) orderItems = [];
                          } catch (e) {
                            console.error('Failed to parse order_items JSON:', e);
                            orderItems = [];
                          }
                        }
                      }
                      
                      // Calculate totals for the order
                      const totalQuantity = orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                      const totalValue = parseFloat(order.order_total || Number(order.order_total) || order.total_value || order.total_amount || 0);
                      
                      // Resolve item name via products list (order_items have only product_id)
                      const itemName = (it) =>
                        it.model_no ||
                        it.product?.model_no ||
                        it.product_name ||
                        products.find(p => String(p.product_id || p.id) === String(it.product_id))?.model_no ||
                        products.find(p => String(p.product_id || p.id) === String(it.product_id))?.product_name ||
                        productNames[String(it.product_id)] ||
                        'Unknown Product';
                      let productDisplay = 'No items';
                      if (orderItems.length === 1) {
                        productDisplay = itemName(orderItems[0]);
                      } else if (orderItems.length > 1) {
                        productDisplay = `${itemName(orderItems[0])} +${orderItems.length - 1} more`;
                      }
                      
                      return (
                        <tr key={orderId || index}>
                          <td className="py-[14px]">{orderNumber}</td>
                          <td className="py-[14px]">{orderTypeDisplay}</td>
                          <td className="py-[14px]">{partyName}</td>
                          <td className="py-[14px] text-[#6b7280]">{productDisplay}</td>
                          <td className="py-[14px]">{totalQuantity}</td>
                          <td className="py-[14px]"><StatusBadge status={orderStatus.toLowerCase().replace(/\s+/g, '-')}>{orderStatus}</StatusBadge></td>
                          <td className="py-[14px]">₹{totalValue.toLocaleString('en-IN')}</td>
                          <td className="py-[14px]">
                            <RowActions onView={()=>console.log('view', order)} />
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
  );
};

export default DistributorDashboard;
