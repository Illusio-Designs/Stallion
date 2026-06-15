import React, { useMemo, useState, useEffect } from 'react';
import Skeleton from '../components/ui/Skeleton';
import { showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import SalesRevenueChart from '../components/charts/SalesRevenueChart';
import { getOrders, getProducts, getProductById, getSalesmanTargets, getSalesmanProfile, getPartiesForRole } from '../services/apiService';
import { getUserRole, getUser } from '../services/authService';

const Dashboard = () => {
  const [period, setPeriod] = useState('Monthly');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // true when the API call failed
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
        setLoadError(false);
        const [ordersData, productsData] = await Promise.all([
          getOrders(),
          getProducts()
        ]);

        setProducts(Array.isArray(productsData) ? productsData : (productsData?.data || []));

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
          try {
            // One call for all parties instead of one getPartyById per order (N+1)
            const allParties = await getPartiesForRole(userRole);
            const map = {};
            (allParties || []).forEach(p => {
              const id = p.id || p.party_id;
              if (id) map[id] = p.party_name || p.name || id;
            });
            setPartyNamesMap(map);
          } catch { /* leave party ids unresolved */ }
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        showError('Could not load dashboard data. Please try again.');
        setLoadError(true);
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
        // Prefer the salesman_id already on the user object; otherwise fetch the
        // current salesman's profile directly - no need to loop every country.
        let foundSalesmanId = user?.salesman_id || null;
        if (!foundSalesmanId) {
          try {
            const profile = await getSalesmanProfile();
            foundSalesmanId = profile?.id || profile?.salesman_id || null;
          } catch { /* no salesman profile */ }
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
      return sum + (Number(order.order_total) || order.total_value || order.total_amount || 0);
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
      return sum + (Number(o.order_total) || o.total_value || o.total_amount || 0);
    }, 0);
    
    // Calculate pending payments (orders that are not completed)
    const pendingOrders = baseOrders.filter(o => 
      o.order_status?.toLowerCase() !== 'completed' && 
      o.order_status?.toLowerCase() !== 'cancelled'
    );
    const pendingPayments = pendingOrders.reduce((sum, o) => {
      return sum + (Number(o.order_total) || o.total_value || o.total_amount || 0);
    }, 0);
    
    // Calculate total revenue across ALL orders
    const totalRevenue = baseOrders.reduce((sum, o) => {
      return sum + (Number(o.order_total) || 0);
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
      totalRevenue,
      activeClients: uniqueClients.size
    };
  }, [orders]);

  // Monthly aggregation for the Sales & Revenue chart — real data from orders
  const chartData = useMemo(() => {
    if (!orders.length) return [];
    const currentYear = new Date().getFullYear();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets = months.map(label => ({ label, sales: 0, revenue: 0 }));
    orders.forEach(o => {
      const raw = o.order_date || o.created_at;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime()) || d.getFullYear() !== currentYear) return;
      const m = d.getMonth();
      const amount = Number(o.order_total) || 0;
      // Both series in ₹ so they share the axis sensibly:
      // Sales = gross order value (all orders); Revenue = realized (completed).
      buckets[m].sales += amount;
      if ((o.order_status || '').toLowerCase() === 'completed') {
        buckets[m].revenue += amount;
      }
    });
    return buckets;
  }, [orders]);

  // Top selling products — aggregate order_items by product_id across all orders
  const topProductRaw = useMemo(() => {
    if (!orders.length) return [];
    // order_items can come back as a JSON string OR an array — normalize first.
    const asItems = (raw) => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return [];
    };
    const qtyByProduct = {};
    orders.forEach(o => {
      asItems(o.order_items).forEach(it => {
        const pid = it.product_id;
        if (pid == null) return;
        qtyByProduct[pid] = (qtyByProduct[pid] || 0) + (Number(it.quantity) || 0);
      });
    });
    return Object.entries(qtyByProduct)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pid, qty]) => ({ pid: String(pid), qty }));
  }, [orders]);

  // Resolve names for top-selling product ids that aren't in the loaded list
  // (limit 20) via an on-demand by-id lookup.
  const [extraNames, setExtraNames] = useState({});
  useEffect(() => {
    const missing = topProductRaw
      .map(t => t.pid)
      .filter(pid => !extraNames[pid] && !products.find(p => String(p.product_id ?? p.id) === pid));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = {};
      await Promise.all(missing.map(async (pid) => {
        try { const p = await getProductById(pid); if (p) map[pid] = p.model_no || p.product_name || p.name; } catch { /* ignore */ }
      }));
      if (!cancelled && Object.keys(map).length) setExtraNames(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProductRaw, products]);

  const topProducts = useMemo(() => topProductRaw.map(({ pid, qty }) => {
    const product = products.find(p => String(p.product_id ?? p.id) === pid);
    return {
      name: product?.model_no || product?.product_name || extraNames[pid] || `Product ${pid.slice(0, 8)}…`,
      units: `${qty} Units`,
    };
  }), [topProductRaw, products, extraNames]);

  // Inventory alerts — out-of-stock first, then low stock, derived from products
  const inventoryAlerts = useMemo(() => {
    if (!products.length) return [];
    const outOfStock = [];
    const lowStock = [];
    products.forEach(p => {
      const stock = Number(p.total_qty ?? p.warehouse_qty ?? 0);
      const entry = {
        name: p.model_no || p.product_name || `Product ${p.product_id ?? p.id}`,
        img: p.image_urls?.[0] || '/images/products/spac1.webp',
        left: `${stock} Left`,
      };
      if (stock === 0) {
        outOfStock.push({ ...entry, tag: 'OUT OF STOCKS', type: 'danger' });
      } else if (stock <= 50) {
        lowStock.push({ ...entry, tag: 'LOW STOCKS', type: 'warn' });
      }
    });
    return [...outOfStock, ...lowStock].slice(0, 5);
  }, [products]);

  // Get recent orders — first 10, sorted by created_at/order_date
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.created_at || b.order_date || 0) - new Date(a.created_at || a.order_date || 0))
      .slice(0, 10);
  }, [orders]);

  // Shown when the API call failed (backend unreachable / erroring)
  const backendDownState = (
    <div className="ui-state ui-state--error">
      <div className="ui-state__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="8" rx="2" />
          <rect x="2" y="13" width="20" height="8" rx="2" />
          <line x1="6" y1="7" x2="6.01" y2="7" />
          <line x1="6" y1="17" x2="6.01" y2="17" />
          <line x1="18" y1="6" x2="22" y2="10" />
          <line x1="22" y1="6" x2="18" y2="10" />
        </svg>
      </div>
      <p className="ui-state__title">Backend not working</p>
      <p className="ui-state__desc">We couldn't reach the server. Please try again later.</p>
    </div>
  );

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3">
          <div className="dash-card metric col-span-3 max-[900px]:col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="m-0 mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Total Sales (This Month)</h4>
            <div className="metric-value text-[var(--text-xl)] font-semibold leading-tight tracking-[-0.02em] text-text [font-variant-numeric:tabular-nums]">
              {loading ? <Skeleton width={90} height={24} /> : `₹${stats.totalSales.toLocaleString('en-IN')}`}
            </div>
            <div className="metric-sub text-[var(--text-xs)] font-medium text-text-muted [font-variant-numeric:tabular-nums]">This month's confirmed sales</div>
          </div>
          <div className="dash-card metric col-span-3 max-[900px]:col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="m-0 mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Total Orders</h4>
            <div className="metric-value text-[var(--text-xl)] font-semibold leading-tight tracking-[-0.02em] text-text [font-variant-numeric:tabular-nums]">
              {loading ? <Skeleton width={90} height={24} /> : `${stats.totalOrders} Orders`}
            </div>
            <div className="metric-sub text-[var(--text-xs)] font-medium text-text-muted [font-variant-numeric:tabular-nums]">Retail {stats.retailOrders} | Bulk {stats.bulkOrders}</div>
          </div>
          <div className="dash-card metric col-span-3 max-[900px]:col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="m-0 mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Active Clients</h4>
            <div className="metric-value text-[var(--text-xl)] font-semibold leading-tight tracking-[-0.02em] text-text [font-variant-numeric:tabular-nums]">
              {loading ? <Skeleton width={90} height={24} /> : stats.activeClients}
            </div>
            <div className="metric-sub text-[var(--text-xs)] font-medium text-text-muted [font-variant-numeric:tabular-nums]">Optical Stores + Enterprises</div>
          </div>
          <div className="dash-card metric col-span-3 max-[900px]:col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="m-0 mb-2 text-[var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Total Revenue</h4>
            <div className="metric-value text-[var(--text-xl)] font-semibold leading-tight tracking-[-0.02em] text-text [font-variant-numeric:tabular-nums]">
              {loading ? <Skeleton width={90} height={24} /> : `₹${stats.totalRevenue.toLocaleString('en-IN')}`}
            </div>
            <div className="metric-sub text-[var(--text-xs)] font-medium text-text-muted [font-variant-numeric:tabular-nums]">Across {stats.totalOrders} orders</div>
          </div>
        </div>

        {!isSalesman && (
        <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3">
          <div className="dash-card tall equal col-span-9 max-[900px]:col-span-full max-[560px]:col-span-full h-[280px] max-[560px]:h-auto max-[560px]:min-h-[240px] flex flex-col [&>*:last-child]:flex-[1_1_auto] bg-surface border border-border rounded-lg shadow-sm p-5">
            <div className="chart-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
              <h4 style={{color: '#000000', fontSize: '14px', fontWeight: '700'}}>Sales & Revenue</h4>
              <select className="ui-select ui-pill chart-period-select" value={period} onChange={(e)=>setPeriod(e.target.value)} style={{height:28, padding:'0px 10px', fontSize:'12px'}}>
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Yearly</option>
              </select>
            </div>
            <SalesRevenueChart data={chartData} height={220} />
          </div>
          <div className="dash-card side equal col-span-3 max-[900px]:col-span-full max-[560px]:col-span-full h-[280px] max-[560px]:h-auto max-[560px]:min-h-[240px] flex flex-col [&>*:last-child]:flex-[1_1_auto] bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 style={{color: '#000000', fontSize: '14px', fontWeight: '700'}}>Quick Actions</h4>
            <div className="btn-col flex flex-col gap-2">
              <button className="ui-btn ui-btn--primary" onClick={() => { window.location.href = '/dashboard/products'; }}>Add New Product</button>
              <button className="ui-btn ui-btn--primary" onClick={() => { window.location.href = '/dashboard/orders'; }}>Create Bulk Order</button>
              <button className="ui-btn ui-btn--primary" onClick={() => { window.location.href = '/dashboard/analytics'; }}>Generate Report</button>
            </div>
          </div>
        </div>
        )}

        {!isSalesman && (
        <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3">
          <div className="dash-card col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="card-title text-text text-[var(--text-md)] font-semibold leading-tight tracking-[-0.01em] mb-3">Top Selling Products</h4>
            <div className="mini-list">
              {topProducts.length === 0 ? (
                loadError ? backendDownState : (
                <div className="ui-state ui-state--empty">
                  <div className="ui-state__icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 3v18h18" />
                      <path d="m7 14 4-4 3 3 5-5" />
                    </svg>
                  </div>
                  <p className="ui-state__title">No sales data yet</p>
                  <p className="ui-state__desc">Top products will appear once orders come in.</p>
                </div>
                )
              ) : topProducts.map((p,i)=> (
                <div key={i} className="row grid grid-cols-[1fr_auto] items-center gap-3 py-3 border-b border-border last:border-b-0">
                  <div className="name text-text font-medium text-[var(--text-sm)] leading-snug">{p.name}</div>
                  <div className="units text-text-muted text-[var(--text-xs)] [font-variant-numeric:tabular-nums]">{p.units}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="dash-card col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="card-title text-text text-[var(--text-md)] font-semibold leading-tight tracking-[-0.01em] mb-3">Inventory Alerts</h4>
            <div className="inv-list">
              {inventoryAlerts.length === 0 ? (
                loadError ? backendDownState : (
                <div className="ui-state ui-state--empty">
                  <div className="ui-state__icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                      <path d="m3.3 7 8.7 5 8.7-5" />
                      <path d="M12 22V12" />
                    </svg>
                  </div>
                  <p className="ui-state__title">All stock levels healthy</p>
                  <p className="ui-state__desc">No low or out-of-stock items right now.</p>
                </div>
                )
              ) : inventoryAlerts.map((r,i)=> (
                <div key={i} className="row grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 border-b border-border last:border-b-0">
                  <span className={`stock-badge ${r.type} inline-flex items-center px-2 py-1 rounded-pill text-[var(--text-xs)] font-semibold leading-tight [font-variant-numeric:tabular-nums] ${r.type === 'warn' ? 'bg-warning-soft text-warning' : 'bg-error-soft text-error'}`}>{r.tag}</span>
                  <div className="name text-text font-medium text-[var(--text-sm)] leading-snug">{r.name}</div>
                  <div className="units text-text-muted text-[var(--text-xs)] [font-variant-numeric:tabular-nums]">{r.left}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

      </div>

      {/* Salesman Targets - before Order Overview */}
      {isSalesman && (
        <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3" style={{marginTop:'16px'}}>
          <div className="dash-card col-span-12 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5" style={{gridColumn:'span 12'}}>
            <h4 style={{color:'#000000', fontSize:'14px', fontWeight:'700', marginBottom:'14px'}}>My Targets</h4>
            <div className="ui-table__scroll">
              <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
                <thead>
                  <tr>
                    {['TARGET AMOUNT','START DATE','END DATE','ORDER TYPE','STATUS','DESCRIPTION','REMARKS'].map(h => (
                      <th key={h} style={{textAlign:'left', padding:'10px 0', fontSize:11, color:'#000', borderBottom:'1px solid #E0E0E0', fontWeight:'600'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`target-skel-${i}`}>
                        {Array.from({ length: 7 }).map((__, c) => (
                          <td key={c} style={{padding:'10px 0'}}>
                            <Skeleton width={c === 5 || c === 6 ? 120 : 80} height={14} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : targets.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{padding:0}}>
                        <div className="ui-state ui-state--empty">
                          <div className="ui-state__icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" />
                              <circle cx="12" cy="12" r="5" />
                              <circle cx="12" cy="12" r="1" />
                            </svg>
                          </div>
                          <p className="ui-state__title">No targets yet</p>
                          <p className="ui-state__desc">You don&apos;t have any sales targets assigned. They&apos;ll appear here once your manager sets them.</p>
                        </div>
                      </td>
                    </tr>
                  ) : targets.map((t, i) => (
                    <tr key={i}>
                      <td style={{padding:'10px 0', fontSize:'13px', fontWeight:'600'}}>₹{parseFloat(t.target_amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{padding:'10px 0', fontSize:'13px'}}>{t.start_date ? new Date(t.start_date).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}) : '-'}</td>
                      <td style={{padding:'10px 0', fontSize:'13px'}}>{t.end_date ? new Date(t.end_date).toLocaleDateString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric'}) : '-'}</td>
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
      <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3" style={{marginTop:'16px'}}>
        <div className="dash-card col-span-12 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5" style={{gridColumn:'span 12'}}>
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
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`order-skel-${i}`}>
                      {Array.from({ length: 6 }).map((__, c) => (
                        <td key={c} style={{padding:'10px 8px'}}>
                          <Skeleton width={c === 0 ? 70 : c === 3 ? 64 : 90} height={14} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{padding:0}}>
                      <div className="ui-state ui-state--empty">
                        <div className="ui-state__icon">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                            <path d="M3 6h18" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                          </svg>
                        </div>
                        <p className="ui-state__title">No orders yet</p>
                        <p className="ui-state__desc">Orders will show up here as soon as they&apos;re placed.</p>
                      </div>
                    </td>
                  </tr>
                ) : recentOrders.map((order, i) => {
                  const orderId = order.order_id || order.id || '';
                  const orderNum = order.order_number || `#${String(orderId).slice(-6)}`;
                  const orderType = (order.order_type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'N/A';
                  const party = order.party?.party_name || order.party_name || order.party?.name || partyNamesMap[order.party_id] || '-';
                  const status = (order.order_status || 'pending').toUpperCase();
                  const value = parseFloat(order.order_total || Number(order.order_total) || order.total_value || order.total_amount || 0);
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
