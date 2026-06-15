import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Skeleton from '../components/ui/Skeleton';
import '../styles/pages/dashboard.css';
import { getOrders, getProducts } from '../services/apiService';
import { getUser } from '../services/authService';
import { showError } from '../services/notificationService';
import StatusBadge from '../components/ui/StatusBadge';
import RowActions from '../components/ui/RowActions';

const PartyDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  // Get partyId once on mount - user data shouldn't change during component lifecycle
  const partyId = useMemo(() => {
    const user = getUser();
    return user?.party_id || user?.partyId;
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [allOrders, productsData] = await Promise.all([getOrders(), getProducts(1, 3000, {})]);
      setProducts(Array.isArray(productsData) ? productsData : (productsData?.data || []));
      // Filter orders for this party
      const currentPartyId = partyId;
      const partyOrders = currentPartyId 
        ? allOrders.filter(order => 
            (order.party_id || order.party?.id || order.party?.party_id) === currentPartyId ||
            order.order_type === 'party_order'
          )
        : allOrders.filter(order => order.order_type === 'party_order');
      setOrders(partyOrders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showError('Could not load your orders. Please try again.');
      setError(error?.message || 'Could not load your orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
        <div className="dash-row orders-summary grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="dash-card metric orders-card col-span-1 sm:col-span-6 lg:col-span-3 bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle mb-2">Total Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `${summaryStats.totalOrders} Orders`}</div>
          </div>
          <div className="dash-card metric orders-card col-span-1 sm:col-span-6 lg:col-span-3 bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle mb-2">Pending Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card col-span-1 sm:col-span-6 lg:col-span-3 bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle mb-2">Completed Orders</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card col-span-1 sm:col-span-6 lg:col-span-3 bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="text-xs font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle mb-2">Total Revenue</h4>
            <div className="metric-value text-xl font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Overview Table */}
        <div className="dash-row grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="dash-card col-span-1 sm:col-span-12 bg-surface border border-border rounded-lg shadow-sm p-5" style={{gridColumn:'span 12'}}>
            <h4 className="text-base font-bold text-black">My Orders</h4>
            <div className="ui-table__scroll">
              <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
                <thead>
                  <tr>
                    {['ORDER ID','ORDER TYPE','PARTY NAME','PRODUCT','QTY','STATUS','VALUE','ACTION'].map((h)=> (
                      <th key={h} style={{textAlign:'left', padding:'14px 0', fontSize:12, color:'#000', borderBottom:'1px solid #E0E0E0'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`sk-${i}`}>
                        {Array.from({ length: 8 }).map((__, c) => (
                          <td key={c} style={{padding:'14px 0'}}>
                            <Skeleton height={16} width={c === 5 ? 90 : '70%'} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : error ? (
                    <tr>
                      <td colSpan="8" style={{padding:0, borderBottom:'none'}}>
                        <div className="ui-state ui-state--error">
                          <div className="ui-state__icon" aria-hidden="true">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          </div>
                          <p className="ui-state__title">Couldn't load your orders</p>
                          <p className="ui-state__desc">{error}</p>
                          <button type="button" className="ui-btn ui-btn--secondary" onClick={fetchOrders}>Try again</button>
                        </div>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{padding:0, borderBottom:'none'}}>
                        <div className="ui-state ui-state--empty">
                          <div className="ui-state__icon" aria-hidden="true">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                              <path d="M14 2v6h6" />
                              <line x1="9" y1="13" x2="15" y2="13" />
                              <line x1="9" y1="17" x2="15" y2="17" />
                            </svg>
                          </div>
                          <p className="ui-state__title">No orders yet</p>
                          <p className="ui-state__desc">Your party orders will appear here once they're placed.</p>
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
                      
                      // Display product information
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
                      
                      return (
                        <tr key={orderId || index}>
                          <td style={{padding:'14px 0'}}>{orderNumber}</td>
                          <td style={{padding:'14px 0'}}>{orderTypeDisplay}</td>
                          <td style={{padding:'14px 0'}}>{partyName}</td>
                          <td style={{padding:'14px 0', color:'#6b7280'}}>{productDisplay}</td>
                          <td style={{padding:'14px 0'}}>{totalQuantity}</td>
                          <td style={{padding:'14px 0'}}><StatusBadge status={orderStatus.toLowerCase().replace(/\s+/g, '-')}>{orderStatus}</StatusBadge></td>
                          <td style={{padding:'14px 0'}}>₹{totalValue.toLocaleString('en-IN')}</td>
                          <td style={{padding:'14px 0'}}>
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

export default PartyDashboard;
