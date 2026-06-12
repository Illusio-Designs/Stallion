import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Skeleton from '../components/ui/Skeleton';
import '../styles/pages/dashboard.css';
import { getOrders } from '../services/apiService';
import { getUser } from '../services/authService';
import { showError } from '../services/notificationService';
import StatusBadge from '../components/ui/StatusBadge';
import RowActions from '../components/ui/RowActions';

const PartyDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Get partyId once on mount - user data shouldn't change during component lifecycle
  const partyId = useMemo(() => {
    const user = getUser();
    return user?.party_id || user?.partyId;
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const allOrders = await getOrders();
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
    <div className="dash-page">
      <div className="dash-container">
        {/* Summary Cards */}
        <div className="dash-row orders-summary">
          <div className="dash-card metric orders-card">
            <h4>Total Orders</h4>
            <div className="metric-value">{loading ? <Skeleton width={90} height={24} /> : `${summaryStats.totalOrders} Orders`}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Pending Orders</h4>
            <div className="metric-value">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingOrders}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Completed Orders</h4>
            <div className="metric-value">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.completedValue.toLocaleString('en-IN')}`}</div>
          </div>
          <div className="dash-card metric orders-card">
            <h4>Total Revenue</h4>
            <div className="metric-value">{loading ? <Skeleton width={90} height={24} /> : `₹${summaryStats.totalRevenue.toLocaleString('en-IN')}`}</div>
          </div>
        </div>

        {/* Order Overview Table */}
        <div className="dash-row">
          <div className="dash-card" style={{gridColumn:'span 12'}}>
            <h4 style={{color: '#000000', fontSize: '16px', fontWeight: '700'}}>My Orders</h4>
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
                    <tr>
                      <td colSpan="8" style={{padding:'20px', textAlign:'center'}}>Loading orders...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{padding:'20px', textAlign:'center'}}>No orders found</td>
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
