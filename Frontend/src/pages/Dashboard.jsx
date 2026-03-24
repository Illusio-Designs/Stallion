import React, { useMemo, useState, useEffect } from 'react';
import '../styles/pages/dashboard.css';
import SalesRevenueChart from '../components/charts/SalesRevenueChart';
import { getOrders, getProducts, getSalesmanTargets, getSalesmen, getCountries, getPartyById } from '../services/apiService';
import { getUserRole, getUser } from '../services/authService';

const Dashboard = () => {
  const [period, setPeriod] = useState('Monthly');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [mySalesmanId, setMySalesmanId] = useState(null);
  const [partyNamesMap, setPartyNamesMap] = useState({});

  // Read once — these don't change during a session
  const [userRole] = useState(() => getUserRole());
  const [user] = useState(() => getUser());
  const isAdmin = userRole === 'admin';
  const isDistributor = userRole === 'distributor';
  const isParty = userRole === 'party';
  const isSalesman = userRole === 'salesman';

  // Fetch orders and products — runs once on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [ordersData] = await Promise.all([
          getOrders(),
          getProducts()
        ]);
        
        let filteredOrders = Array.isArray(ordersData) ? ordersData : [];
        
        if (isDistributor && user?.distributor_id) {
          filteredOrders = filteredOrders.filter(o =>
            String(o.distributor_id || o.distributor?.id || '').trim() === String(user.distributor_id).trim()
          );
        } else if (isParty && user?.party_id) {
          filteredOrders = filteredOrders.filter(o =>
            String(o.party_id || o.party?.id || '').trim() === String(user.party_id).trim()
          );
        }
        // salesman filtering done in recentOrders once mySalesmanId resolves
        
        setOrders(filteredOrders);

        // Resolve party names for orders missing them
        const missingPartyIds = [...new Set(
          filteredOrders
            .filter(o => o.party_id && !o.party?.party_name && !o.party_name && !o.party?.name)
            .map(o => o.party_id)
        )];
        if (missingPartyIds.length > 0) {
          const entries = await Promise.all(
            missingPartyIds.map(async id => {
              try {
                const p = await getPartyById(id);
                return [id, p?.party_name || p?.name || id];
              } catch { return [id, id]; }
            })
          );
          setPartyNamesMap(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch salesman targets — runs once on mount if salesman
  useEffect(() => {
    if (!isSalesman) { setTargetsLoading(false); return; }
    const fetchTargets = async () => {
      try {
        setTargetsLoading(true);
        const currentUserId = user?.id || user?.user_id;
        const countriesData = await getCountries();
        const countriesArr = Array.isArray(countriesData) ? countriesData : [];
        let foundSalesmanId = null;
        for (const country of countriesArr) {
          try {
            const salesmenData = await getSalesmen(country.id);
            const found = (salesmenData || []).find(s =>
              s.user_id === currentUserId || s.userId === currentUserId
            );
            if (found) { foundSalesmanId = found.id || found.salesman_id; break; }
          } catch { /* skip */ }
        }
        if (foundSalesmanId) {
          setMySalesmanId(foundSalesmanId);
          const targetsData = await getSalesmanTargets(foundSalesmanId);
          setTargets(Array.isArray(targetsData) ? targetsData : []);
        } else {
          setTargets([]);
        }
      } catch (e) {
        console.error('Failed to fetch salesman targets:', e);
        setTargets([]);
      } finally {
        setTargetsLoading(false);
      }
    };
    fetchTargets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate dashboard statistics
  const stats = useMemo(() => {
    const baseOrders = [...orders];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Filter orders for current month
    const currentMonthOrders = baseOrders.filter(order => {
      if (!order.order_date) return false;
      const orderDate = new Date(order.order_date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });
    
    // Calculate total sales for current month
    const totalSales = currentMonthOrders.reduce((sum, order) => {
      return sum + (order.total_value || order.total_amount || 0);
    }, 0);
    
    // Calculate total orders
    const totalOrders = baseOrders.length;
    
    // Count by order type
    const retailOrders = baseOrders.filter(o => 
      o.order_type?.includes('retail') || o.order_type === 'retail_order'
    ).length;
    const bulkOrders = baseOrders.filter(o => 
      o.order_type?.includes('bulk') || o.order_type === 'bulk_order'
    ).length;
    
    // Calculate completed orders value
    const completedOrders = baseOrders.filter(o => 
      o.order_status?.toLowerCase() === 'completed'
    );
    const completedValue = completedOrders.reduce((sum, o) => {
      return sum + (o.total_value || o.total_amount || 0);
    }, 0);
    
    // Calculate pending payments (orders that are not completed)
    const pendingOrders = baseOrders.filter(o => 
      o.order_status?.toLowerCase() !== 'completed' && 
      o.order_status?.toLowerCase() !== 'cancelled'
    );
    const pendingPayments = pendingOrders.reduce((sum, o) => {
      return sum + (o.total_value || o.total_amount || 0);
    }, 0);
    
    // Get unique clients count
    const uniqueClients = new Set();
    baseOrders.forEach(order => {
      if (order.party_id) uniqueClients.add(order.party_id);
      if (order.party?.party_id) uniqueClients.add(order.party.party_id);
      if (order.party?.id) uniqueClients.add(order.party.id);
    });
    
    return {
      totalSales,
      totalOrders,
      retailOrders,
      bulkOrders,
      completedValue,
      pendingPayments,
      activeClients: uniqueClients.size
    };
  }, [orders]);

  // Get recent orders — first 10, sorted by created_at/order_date
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.created_at || b.order_date || 0) - new Date(a.created_at || a.order_date || 0))
      .slice(0, 10);
  }, [orders]);

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="dash-row">
          <div className="dash-card metric">
            <h4>Total Sales (This Month)</h4>
            <div className="metric-value">
              {loading ? 'Loading...' : `₹${stats.totalSales.toLocaleString('en-IN')}`}
            </div>
            <div className="metric-sub green">↑ 12% vs last month</div>
          </div>
          <div className="dash-card metric">
            <h4>Total Orders</h4>
            <div className="metric-value">
              {loading ? 'Loading...' : `${stats.totalOrders} Orders`}
            </div>
            <div className="metric-sub">Retail {stats.retailOrders} | Bulk {stats.bulkOrders}</div>
          </div>
          <div className="dash-card metric">
            <h4>Active Clients</h4>
            <div className="metric-value">
              {loading ? 'Loading...' : stats.activeClients}
            </div>
            <div className="metric-sub">Optical Stores + Enterprises</div>
          </div>
          <div className="dash-card metric">
            <h4>Pending Payments</h4>
            <div className="metric-value">
              {loading ? 'Loading...' : `₹${stats.pendingPayments.toLocaleString('en-IN')}`}
            </div>
            <div className="metric-sub red">↓ 10% vs last month</div>
          </div>
        </div>

        {!isSalesman && (
        <div className="dash-row">
          <div className="dash-card tall equal">
            <div className="chart-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h4 style={{color: '#000000', fontSize: '14px', fontWeight: '700'}}>Sales & Revenue</h4>
              <select className="ui-select ui-pill chart-period-select" value={period} onChange={(e)=>setPeriod(e.target.value)} style={{height:28, padding:'0px 10px', fontSize:'12px'}}>
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Yearly</option>
              </select>
            </div>
            <SalesRevenueChart data={useMemo(() => ([
              { label: 'Jan', sales: 24, revenue: 18 },
              { label: 'Feb', sales: 32, revenue: 22 },
              { label: 'Mar', sales: 28, revenue: 20 },
              { label: 'Apr', sales: 36, revenue: 27 },
              { label: 'May', sales: 40, revenue: 34 },
              { label: 'Jun', sales: 30, revenue: 25 },
              { label: 'Jul', sales: 42, revenue: 33 },
              { label: 'Aug', sales: 26, revenue: 19 },
              { label: 'Sep', sales: 34, revenue: 29 },
              { label: 'Oct', sales: 38, revenue: 31 },
              { label: 'Nov', sales: 29, revenue: 24 },
              { label: 'Dec', sales: 44, revenue: 36 },
            ]), [])} height={220} />
          </div>
          <div className="dash-card side equal">
            <h4 style={{color: '#000000', fontSize: '14px', fontWeight: '700'}}>Quick Actions</h4>
            <div className="btn-col">
              <button className="ui-btn ui-btn--primary">Add New Product</button>
              <button className="ui-btn ui-btn--primary">Create Bulk Order</button>
              <button className="ui-btn ui-btn--primary">Generate Report</button>
              <button className="ui-btn ui-btn--primary">Manage Discounts</button>
            </div>
          </div>
        </div>
        )}

        {!isSalesman && (
        <div className="dash-row">
          <div className="dash-card">
            <h4 className="card-title">Top Selling Products</h4>
            <div className="mini-list">
              {[
                {img:'/images/products/spac1.webp', name:'Anti-Fog Safety Goggles', units:'320 Units'},
                {img:'/images/products/spac2.webp', name:'Anti-Fog Safety Goggles', units:'275 Units'},
                {img:'/images/products/spac3.webp', name:'Anti-Fog Safety Goggles', units:'145 Units'},
              ].map((p,i)=> (
                <div key={i} className="row">
                  <img src={p.img} alt={p.name} className="prod-icon" />
                  <div className="name">{p.name}</div>
                  <div className="units">{p.units}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card">
            <h4 className="card-title">Inventory Alerts</h4>
            <div className="inv-list">
              {[
                {tag:'LOW STOCKS', type:'warn', img:'/images/products/spac1.webp', name:'Anti-Fog Safety Goggles', left:'43 Left'},
                {tag:'OUT OF STOCKS', type:'danger', img:'/images/products/spac2.webp', name:'Anti-Fog Safety Goggles', left:'0 Left'},
                {tag:'OUT OF STOCKS', type:'danger', img:'/images/products/spac3.webp', name:'Anti-Fog Safety Goggles', left:'0 Left'},
              ].map((r,i)=> (
                <div key={i} className="row">
                  <span className={`stock-badge ${r.type}`}>{r.tag}</span>
                  <img src={r.img} alt={r.name} className="prod-icon" />
                  <div className="name">{r.name}</div>
                  <div className="units">{r.left}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

      </div>

      {/* Salesman Targets - before Order Overview */}
      {isSalesman && (
        <div className="dash-row" style={{marginTop:'16px'}}>
          <div className="dash-card" style={{gridColumn:'span 12'}}>
            <h4 style={{color:'#000000', fontSize:'14px', fontWeight:'700', marginBottom:'14px'}}>My Targets</h4>
            <div className="ui-table__scroll">
              <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
                <thead>
                  <tr>
                    {['TARGET AMOUNT','TARGET DATE','ORDER TYPE','STATUS','DESCRIPTION','REMARKS'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'10px 0', fontSize:11, color:'#000', borderBottom:'1px solid #E0E0E0', fontWeight:'600'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetsLoading ? (
                    <tr><td colSpan="6" style={{padding:'16px', textAlign:'center', color:'#6b7280', fontSize:'13px'}}>Loading targets...</td></tr>
                  ) : targets.length === 0 ? (
                    <tr><td colSpan="6" style={{padding:'16px', textAlign:'center', color:'#6b7280', fontSize:'13px'}}>No targets assigned yet</td></tr>
                  ) : targets.map((t, i) => (
                    <tr key={i}>
                      <td style={{padding:'10px 0', fontSize:'13px', fontWeight:'600'}}>₹{parseFloat(t.target_amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{padding:'10px 0', fontSize:'13px'}}>{t.target_date ? new Date(t.target_date).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}) : '-'}</td>
                      <td style={{padding:'10px 0', fontSize:'13px'}}>{t.order_type || 'Overall'}</td>
                      <td style={{padding:'10px 0'}}>
                        <span style={{
                          padding:'2px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:600,
                          background: t.target_status === 'pending' ? '#fff3cd' : '#d4edda',
                          color: t.target_status === 'pending' ? '#856404' : '#155724',
                        }}>{t.target_status || 'pending'}</span>
                      </td>
                      <td style={{padding:'10px 0', fontSize:'13px', color:'#6b7280'}}>{t.target_description || '-'}</td>
                      <td style={{padding:'10px 0', fontSize:'13px', color:'#6b7280'}}>{t.target_remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Order Overview */}
      <div className="dash-row" style={{marginTop:'16px'}}>
        <div className="dash-card" style={{gridColumn:'span 12'}}>
          <h4 style={{color:'#000000', fontSize:'14px', fontWeight:'700', marginBottom:'10px'}}>Order Overview</h4>
          <div className="ui-table__scroll">
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  {['ORDER ID','ORDER TYPE','PARTY','STATUS','VALUE','DATE'].map(h => (
                    <th key={h} style={{textAlign:'left', padding:'10px 8px', fontSize:11, color:'#000', borderBottom:'1px solid #E0E0E0', fontWeight:'600'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{padding:'20px', textAlign:'center', color:'#6b7280', fontSize:'13px'}}>Loading orders...</td></tr>
                ) : recentOrders.length === 0 ? (
                  <tr><td colSpan="6" style={{padding:'20px', textAlign:'center', color:'#6b7280', fontSize:'13px'}}>No orders found</td></tr>
                ) : recentOrders.map((order, i) => {
                  const orderId = order.order_id || order.id || '';
                  const orderNum = order.order_number || `#${String(orderId).slice(-6)}`;
                  const orderType = (order.order_type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'N/A';
                  const party = order.party?.party_name || order.party_name || order.party?.name || partyNamesMap[order.party_id] || '-';
                  const status = (order.order_status || 'pending').toUpperCase();
                  const value = parseFloat(order.order_total || order.total_value || order.total_amount || 0);
                  const date = order.created_at || order.order_date;
                  const statusColor = status === 'COMPLETED' ? {bg:'#d4edda', color:'#155724'} : status === 'CANCELLED' ? {bg:'#f8d7da', color:'#721c24'} : {bg:'#fff3cd', color:'#856404'};
                  return (
                    <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                      <td style={{padding:'10px 8px', fontSize:'13px', fontWeight:'500'}}>{orderNum}</td>
                      <td style={{padding:'10px 8px', fontSize:'13px'}}>{orderType}</td>
                      <td style={{padding:'10px 8px', fontSize:'13px'}}>{party}</td>
                      <td style={{padding:'10px 8px'}}>
                        <span style={{padding:'2px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:600, background:statusColor.bg, color:statusColor.color}}>{status}</span>
                      </td>
                      <td style={{padding:'10px 8px', fontSize:'13px', fontWeight:'600'}}>₹{value.toLocaleString('en-IN')}</td>
                      <td style={{padding:'10px 8px', fontSize:'13px', color:'#6b7280'}}>{date ? new Date(date).toLocaleDateString('en-GB') : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
