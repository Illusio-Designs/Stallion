import React, { useMemo, useState, useEffect } from 'react';
import Skeleton from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';
import TableWithControls from '../components/ui/TableWithControls';
import { showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import OrdersPerDayChart from '../components/charts/OrdersPerDayChart';
import { getOrdersForRole, getProducts, getProductsByIds, getSalesmanTargets, getSalesmanProfile, getPartiesForRole, getAllSalesmanTargets, getTrays, getIndianCountries, getSalesmen, getAllSalesmanCheckins } from '../services/apiService';
import { getAllAdminExpenses } from '../services/expenseService';
import { getUserRole, getUserRoles, getUser } from '../services/authService';
import { FiMapPin, FiShoppingBag, FiBarChart2, FiShoppingCart, FiTag, FiChevronRight, FiUsers, FiUser, FiAlertTriangle, FiClock, FiDollarSign, FiPackage, FiInbox, FiNavigation2 } from 'react-icons/fi';

const Dashboard = () => {
  const [range, setRange] = useState('30d'); // orders chart: today | 7d | 30d | year
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // true when the API call failed
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [mySalesmanId, setMySalesmanId] = useState(null);
  const [partyNamesMap, setPartyNamesMap] = useState({});
  const [myPartyCount, setMyPartyCount] = useState(null); // distributor: parties assigned to them
  const [partiesNoLocation, setPartiesNoLocation] = useState(null); // office view: parties without a saved shop location
  const [ownParties, setOwnParties] = useState([]); // salesman / distributor / party: their own parties (server scoped)
  const [allTargets, setAllTargets] = useState([]); // office view: every salesman's targets

  // Read once — these don't change during a session
  const [userRole] = useState(() => getUserRole());
  const [user] = useState(() => getUser());
  const [userRoles] = useState(() => getUserRoles());
  const [pendingExpenses, setPendingExpenses] = useState(null); // office: expense claims waiting for approval
  const [traysOut, setTraysOut] = useState(null); // office: sample trays still with a salesman
  const [fieldStats, setFieldStats] = useState(null); // office: { active, total, visitsToday }
  const [coords, setCoords] = useState(null); // salesman: current position (only when the browser allows it)

  // The role comes from localStorage, which doesn't exist during SSR, so the
  // server renders with no role (admin-default blocks) while the client renders
  // the real role → hydration mismatch. Defer all role-gated rendering until
  // after mount so the server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const role = mounted ? userRole : null;
  const isAdmin = role === 'admin';
  const isDistributor = role === 'distributor';
  const isParty = role === 'party';
  const isSalesman = role === 'salesman';

  // Fetch orders and products — runs once on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const [ordersData, productsData] = await Promise.all([
          getOrdersForRole(userRole),
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

  // The role's own parties (the server scopes this list to them): a distributor's count and
  // table, a salesman's party table, a party's own record (credit days).
  useEffect(() => {
    if (!['distributor', 'salesman', 'party'].includes(userRole)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPartiesForRole(userRole);
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (cancelled) return;
        setOwnParties(list);
        if (userRole === 'distributor') setMyPartyCount(list.length);
      } catch { /* fall back to parties seen in orders */ }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Office view: how many parties still have no saved shop location (salesmen cannot
  // place visit orders for them). Only managers need this, so field roles skip the call.
  useEffect(() => {
    if (['salesman', 'party', 'distributor'].includes(userRole)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPartiesForRole(userRole);
        const list = Array.isArray(res) ? res : (res?.data || []);
        const missing = list.filter((p) => p.is_active !== false && !(p.latitude != null && p.longitude != null)).length;
        if (!cancelled) setPartiesNoLocation(missing);
      } catch { /* the panel just omits this line */ }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Office view: every salesman's target, for the "Salesmen against target" table.
  useEffect(() => {
    if (['salesman', 'party', 'distributor'].includes(userRole)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getAllSalesmanTargets();
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (!cancelled) setAllTargets(list);
      } catch { /* the table is simply not shown */ }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Office view extras. Each call is made only for the roles that can open that page and fails
  // silently (the item or number is just left out): no error toast.
  useEffect(() => {
    if (['salesman', 'party', 'distributor'].includes(userRole)) return;
    const has = (...names) => userRoles.some((r) => names.includes(r));
    let cancelled = false;
    if (has('admin', 'expense_manager', 'sales_manager')) {
      (async () => {
        try {
          const res = await getAllAdminExpenses();
          const list = Array.isArray(res) ? res : (res?.data || []);
          if (!cancelled) setPendingExpenses(list.filter((e) => String(e.status || 'pending').toLowerCase() === 'pending').length);
        } catch { /* item omitted */ }
      })();
    }
    if (has('admin', 'tray_manager')) {
      (async () => {
        try {
          const list = await getTrays();
          if (!cancelled) setTraysOut((list || []).filter((t) => String(t.tray_status || '').toLowerCase() === 'assigned').length);
        } catch { /* item omitted */ }
      })();
    }
    if (has('admin', 'sales_manager')) {
      (async () => {
        let active = null;
        let visitsToday = null;
        try {
          const cr = await getIndianCountries();
          const countries = Array.isArray(cr) ? cr : (cr?.data || []);
          const lists = await Promise.all(countries.map((c) => getSalesmen(c.id || c.country_id).catch(() => [])));
          const all = lists.flat().filter(Boolean);
          active = { on: all.filter((s) => s.is_active !== false).length, total: all.length };
        } catch { /* number omitted */ }
        try {
          const cr = await getAllSalesmanCheckins(100);
          const rows = Array.isArray(cr) ? cr : (cr?.data || []);
          const t = new Date().toDateString();
          visitsToday = rows.filter((c) => { const d = new Date(c.check_in_date || c.created_at); return !isNaN(d.getTime()) && d.toDateString() === t; }).length;
        } catch { /* number omitted */ }
        if (!cancelled) setFieldStats({ active, visitsToday });
      })();
    }
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Salesman: where am I, only if the browser already lets us (never prompts on load)
  useEffect(() => {
    if (userRole !== 'salesman' || typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' }).then((st) => {
      if (st.state !== 'granted' || cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (p) => { if (!cancelled) setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        () => {}, { maximumAge: 120000, timeout: 8000 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch salesman targets — runs once on mount if salesman.
  // Key off the RAW userRole, not the mounted-gated `isSalesman`: this effect
  // runs once on mount when the gated role is still null, so using `isSalesman`
  // here would always bail and the targets would never load.
  useEffect(() => {
    if (userRole !== 'salesman') { setTargetsLoading(false); return; }
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

  const statusOf = (o) => String(o.order_status || 'pending').toLowerCase();
  const amountOf = (o) => Number(o.order_total) || Number(o.total_value) || Number(o.total_amount) || 0;

  // Calculate dashboard statistics. Cancelled orders never count towards money.
  const stats = useMemo(() => {
    const baseOrders = [...orders];
    const live = baseOrders.filter((o) => statusOf(o) !== 'cancelled');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const currentMonthOrders = live.filter((order) => {
      if (!order.order_date) return false;
      const orderDate = new Date(order.order_date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });
    const totalSales = currentMonthOrders.reduce((sum, o) => sum + amountOf(o), 0);
    const prevMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthSales = live
      .filter((o) => {
        if (!o.order_date) return false;
        const d = new Date(o.order_date);
        return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
      })
      .reduce((sum, o) => sum + amountOf(o), 0);
    const totalRevenue = live.reduce((sum, o) => sum + amountOf(o), 0);

    const completedCount = live.filter((o) => statusOf(o) === 'completed').length;
    const openOrders = live.filter((o) => statusOf(o) !== 'completed');

    const uniqueClients = new Set();
    live.forEach((order) => {
      if (order.party_id) uniqueClients.add(order.party_id);
      if (order.party?.party_id) uniqueClients.add(order.party.party_id);
      if (order.party?.id) uniqueClients.add(order.party.id);
    });

    return {
      totalSales,
      lastMonthSales,
      totalOrders: baseOrders.length,
      completedCount,
      openCount: openOrders.length,
      openOrders,
      totalRevenue,
      activeClients: uniqueClients.size,
    };
  }, [orders]);

  // Orders per day (or hour / month) for the chosen range. Cancelled orders are left out.
  const ordersChart = useMemo(() => {
    const live = orders.filter((o) => statusOf(o) !== 'cancelled');
    const dateOf = (o) => {
      const d = new Date(o.created_at || o.order_date);
      return isNaN(d.getTime()) ? null : d;
    };
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let buckets = [];
    let place;
    let sub;
    if (range === 'today') {
      sub = 'Today, by hour';
      buckets = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: 0, current: h === now.getHours(), title: `${h}:00` }));
      place = (d) => (dayStart(d) === dayStart(now) ? buckets[d.getHours()] : null);
    } else if (range === 'year') {
      sub = 'This year, by month';
      buckets = monthNames.map((m, i) => ({ label: m, value: 0, current: i === now.getMonth(), title: `${m} ${now.getFullYear()}` }));
      place = (d) => (d.getFullYear() === now.getFullYear() ? buckets[d.getMonth()] : null);
    } else {
      const days = range === '7d' ? 7 : 30;
      sub = `Last ${days} days`;
      const today = dayStart(now);
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        buckets.push({ key: d.getTime(), label: String(d.getDate()), value: 0, current: i === 0, title: `${d.getDate()} ${monthNames[d.getMonth()]}` });
      }
      place = (d) => buckets.find((b) => b.key === dayStart(d)) || null;
    }
    live.forEach((o) => {
      const d = dateOf(o);
      const b = d && place(d);
      if (b) b.value += 1;
    });
    buckets.forEach((b) => { b.title = `${b.title}: ${b.value} order${b.value === 1 ? '' : 's'}`; });
    const total = buckets.reduce((n, b) => n + b.value, 0);
    return { buckets, sub, total };
  }, [orders, range]);

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
    // Name snapshot captured from order_items at order time (model_no). This
    // survives a later product deletion, so we can label the row without any
    // live lookup — the main reason rows used to show "Unknown Product".
    const nameByProduct = {};
    orders.forEach(o => {
      asItems(o.order_items).forEach(it => {
        const pid = it.product_id;
        if (pid == null) return;
        const key = String(pid);
        qtyByProduct[key] = (qtyByProduct[key] || 0) + (Number(it.quantity) || 0);
        if (!nameByProduct[key] && it.model_no) nameByProduct[key] = it.model_no;
      });
    });
    return Object.entries(qtyByProduct)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pid, qty]) => ({ pid: String(pid), qty, name: nameByProduct[pid] || null }));
  }, [orders]);

  // Fallback name resolution for top-selling ids that have NO snapshot name and
  // aren't in the loaded list (kept at limit 20). One batched by-id request for
  // all missing ids (at most 3) instead of a 1000-row fetch per id — far less
  // likely to time out, and no big payloads.
  const [extraNames, setExtraNames] = useState({});
  useEffect(() => {
    const missing = topProductRaw
      .filter(t => !t.name) // already labelled from the order_items snapshot
      .map(t => t.pid)
      .filter(pid => !extraNames[pid] && !products.find(p => String(p.product_id ?? p.id) === pid));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getProductsByIds(missing);
        const map = {};
        (list || []).forEach((p) => {
          const pid = String(p.product_id ?? p.id);
          const nm = p.model_no || p.product_name || p.name;
          if (nm) map[pid] = nm;
        });
        if (!cancelled && Object.keys(map).length) setExtraNames(prev => ({ ...prev, ...map }));
      } catch { /* ignore — row falls back to "Unknown Product" */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProductRaw, products]);

  const topProducts = useMemo(() => topProductRaw.map(({ pid, qty, name }) => {
    const product = products.find(p => String(p.product_id ?? p.id) === pid);
    return {
      // Prefer the live product's current model_no; fall back to the order-time
      // snapshot (survives deletes), then the batched lookup, then Unknown.
      name: product?.model_no || product?.product_name || name || extraNames[pid] || 'Unknown Product',
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

  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  // Short money for the big numbers: 18.4L, 1.2Cr (the full value stays in the title).
  const shortMoney = (n) => {
    const v = Number(n || 0);
    if (v >= 1e7) return { sym: '₹', num: `${(v / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr` };
    if (v >= 1e5) return { sym: '₹', num: `${(v / 1e5).toFixed(2).replace(/\.?0+$/, '')}L` };
    return { sym: '₹', num: v.toLocaleString('en-IN') };
  };
  const partiesCount = isDistributor && myPartyCount != null ? myPartyCount : stats.activeClients;
  const noLocation = ownParties.filter((p) => p.is_active !== false && !(p.latitude != null && p.longitude != null)).length;
  const ownParty = isParty ? (ownParties[0] || null) : null;

  // Role-aware targets: a salesman's own, for the ring and for the first number card.
  const targetTotal = targets.reduce((n, t) => n + Number(t.target_amount || 0), 0);
  const targetDone = targets.reduce((n, t) => n + Number(t.completed_amount || 0), 0);
  const targetPct = targetTotal > 0 ? Math.round((targetDone / targetTotal) * 100) : 0;
  const RING_C = 2 * Math.PI * 34;

  // The four headline numbers, worded for whoever is looking at the page.
  // money: true => shown as a short rupee value (₹ 18.4L); icon is display only.
  let monthDelta = null;
  if (stats.lastMonthSales > 0) {
    const pct = ((stats.totalSales - stats.lastMonthSales) / stats.lastMonthSales) * 100;
    monthDelta = { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, dir: pct >= 0 ? 'up' : 'dn' };
  }
  const kpis = isParty
    ? [
        { icon: FiDollarSign, label: 'Ordered this month', money: stats.totalSales, sub: "This month's orders, cancelled excluded" },
        { icon: FiShoppingBag, label: 'Open orders', value: stats.openCount, sub: 'Waiting to be completed' },
        ownParty && ownParty.credit_days != null
          ? { icon: FiClock, label: 'Credit days', value: ownParty.credit_days, sub: 'Set by your manager' }
          : { icon: FiShoppingBag, label: 'My orders', value: stats.totalOrders, sub: `Open ${stats.openCount} | Completed ${stats.completedCount}` },
        { icon: FiDollarSign, label: 'Total spent', money: stats.totalRevenue, sub: `Across ${stats.totalOrders} orders` },
      ]
    : isDistributor
    ? [
        { icon: FiDollarSign, label: 'Sales this month', money: stats.totalSales, sub: "Your parties' orders this month" },
        { icon: FiUsers, label: 'My parties', value: partiesCount, sub: 'Parties assigned to you' },
        { icon: FiShoppingBag, label: 'Open orders', value: stats.openCount, sub: `Of ${stats.totalOrders} orders` },
        { icon: FiDollarSign, label: 'Total value', money: stats.totalRevenue, sub: `Across ${stats.totalOrders} orders` },
      ]
    : isSalesman
    ? [
        { icon: FiDollarSign, label: 'My sales', money: stats.totalSales, sub: targetTotal > 0 ? `${targetPct}% of ${money(targetTotal)} target` : "This month's orders", subTone: targetTotal > 0 ? 'up' : null },
        { icon: FiShoppingBag, label: 'My orders', value: stats.totalOrders, sub: `${stats.openCount} open | ${stats.completedCount} completed` },
        { icon: FiUsers, label: 'My parties', value: ownParties.length || stats.activeClients, sub: ownParties.length ? (noLocation > 0 ? `${noLocation} without a shop location` : 'All have a shop location') : 'Parties you ordered for' },
        { icon: FiDollarSign, label: 'Total value', money: stats.totalRevenue, sub: `Across ${stats.totalOrders} orders` },
      ]
    : [
        { icon: FiDollarSign, label: 'Sales this month', money: stats.totalSales, sub: "This month's confirmed sales", delta: monthDelta, deltaText: 'than last month' },
        { icon: FiShoppingBag, label: 'Total orders', value: stats.totalOrders, sub: `Open ${stats.openCount} | Completed ${stats.completedCount}` },
        { icon: FiUsers, label: 'Active clients', value: stats.activeClients, sub: 'Optical Stores + Enterprises' },
        { icon: FiDollarSign, label: 'Total revenue', money: stats.totalRevenue, sub: `Across ${stats.totalOrders} orders (cancelled excluded)` },
      ];

  // Only pages the role can really open.
  const go = (path) => () => { window.location.href = path; };

  // "Needs attention": things only a person can decide. Office view only.
  const isOfficeView = !isSalesman && !isParty && !isDistributor;
  const attention = [];
  if (isOfficeView) {
    const outOfStockCount = products.filter((p) => Number(p.total_qty ?? p.warehouse_qty ?? 0) === 0).length;
    if (outOfStockCount > 0) {
      attention.push({ icon: FiAlertTriangle, tone: 'bad', title: `${outOfStockCount} item${outOfStockCount > 1 ? 's' : ''} out of stock`, desc: inventoryAlerts.filter((a) => a.type === 'danger').slice(0, 3).map((a) => a.name || a.model_no).filter(Boolean).join(', ') || 'Check the product list', onClick: go('/dashboard/products') });
    }
    if (partiesNoLocation > 0) {
      attention.push({ icon: FiMapPin, tone: 'warn', title: `${partiesNoLocation} part${partiesNoLocation > 1 ? 'ies have' : 'y has'} no shop location`, desc: 'Salesmen cannot place visit orders for them', onClick: go('/dashboard/party') });
    }
    if (pendingExpenses > 0) {
      attention.push({ icon: FiDollarSign, tone: 'warn', title: `${pendingExpenses} expense claim${pendingExpenses > 1 ? 's' : ''} to approve`, desc: 'Waiting for approval or rejection', onClick: go('/dashboard/expenses') });
    }
    if (traysOut > 0) {
      attention.push({ icon: FiInbox, tone: 'warn', title: `${traysOut} sample tray${traysOut > 1 ? 's' : ''} not returned`, desc: 'Still with a salesman', onClick: go('/dashboard/tray') });
    }
    if (stats.openCount > 0) {
      attention.push({ icon: FiClock, tone: 'info', title: `${stats.openCount} open order${stats.openCount > 1 ? 's' : ''} waiting`, desc: 'Pending, processing or ready to dispatch', onClick: go('/dashboard/orders') });
    }
  }
  // Shortcuts that sit in the greeting header (first one is the black button).
  const quickActions = isParty
    ? [
        { icon: FiShoppingCart, label: 'Order frames', primary: true, onClick: go('/products') },
        { icon: FiShoppingBag, label: 'My orders', onClick: go('/dashboard/orders') },
      ]
    : isDistributor
    ? [
        { icon: FiShoppingCart, label: 'Place an order', primary: true, onClick: go('/products') },
        { icon: FiUsers, label: 'My parties', onClick: go('/dashboard/party') },
      ]
    : isSalesman
    ? [
        { icon: FiMapPin, label: 'Add visit', primary: true, onClick: go('/dashboard/salesmen') },
        { icon: FiShoppingBag, label: 'My orders', onClick: go('/dashboard/orders') },
        { icon: FiBarChart2, label: 'Report', onClick: go('/dashboard/analytics') },
      ]
    : [];
  // Salesman phone card: their first party with a saved shop location (distance only if the browser shared it)
  const shopParty = ownParties.find((p) => p.latitude != null && p.longitude != null) || null;
  const shopCity = shopParty ? (shopParty.city?.name || shopParty.city_name || (typeof shopParty.city === 'string' ? shopParty.city : '')) : '';
  let shopKm = null;
  if (shopParty && coords) {
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(Number(shopParty.latitude) - coords.lat);
    const dLng = rad(Number(shopParty.longitude) - coords.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(coords.lat)) * Math.cos(rad(Number(shopParty.latitude))) * Math.sin(dLng / 2) ** 2;
    shopKm = Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10;
  }
  const ownData = isParty || isDistributor; // their own orders only: no warehouse stock

  // Greeting header
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayText = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  // localStorage and the clock only exist in the browser: keep the first render identical to the server's.
  const viewer = mounted ? user : null;
  const fullName = String(viewer?.full_name || viewer?.name || '').trim();
  const firstName = fullName.split(/\s+/)[0] || '';
  const companyName = (ownParty && (ownParty.party_name || ownParty.name)) || viewer?.party_name || viewer?.distributor_name || fullName;
  const heading = isSalesman
    ? `Hi ${firstName || 'there'}`
    : (isParty || isDistributor)
    ? (companyName || 'Welcome')
    : mounted ? `${greeting}${firstName ? `, ${firstName}` : ''}` : 'Welcome';
  const subline = isSalesman
    ? 'Only your own parties, orders and visits are shown here.'
    : isParty
    ? 'Your own orders and account only.'
    : isDistributor
    ? 'Only your own parties and their orders are shown.'
    : !mounted ? '' : `${todayText}.${stats.openCount > 0 ? ` ${stats.openCount} order${stats.openCount > 1 ? 's are' : ' is'} still open.` : ''}`;

  const RANGES = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['year', 'Year']];
  const partyOf = (row) => row.party?.party_name || row.party_name || row.party?.name || partyNamesMap[row.party_id] || '-';
  const orderRef = (row) => row.order_number || `#${String(row.order_id || row.id || '').slice(-6)}`;
  const statusPill = (v) => { const st = v || 'pending'; return <StatusBadge status={String(st).toLowerCase().replace(/\s+/g, '-')}>{String(st).charAt(0).toUpperCase() + String(st).slice(1).toLowerCase()}</StatusBadge>; };
  const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // Salesmen against target (office view): this month's targets, one row per salesman.
  const targetRows = (() => {
    const by = {};
    allTargets.forEach((t) => {
      const id = t.salesman_id || t.salesman_name;
      if (!id) return;
      const row = by[id] || (by[id] = { id, name: t.salesman_name || 'Salesman', target: 0, done: 0 });
      row.target += Number(t.target_amount || 0);
      row.done += Number(t.completed_amount || 0);
    });
    return Object.values(by).filter((r) => r.target > 0).sort((a, b) => (b.done / b.target) - (a.done / a.target)).slice(0, 6);
  })();

  const latestOrders = recentOrders.slice(0, 6);
  const ordersCard = (title, sub, linkLabel, cols) => (
    <section className="rda-card" aria-label={title}>
      <div className="rda-card__head">
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        <a href="/dashboard/orders" className="rda-link">{linkLabel}</a>
      </div>
      <div className="rda-tw">
        <table className="rda-table">
          <thead><tr>{cols.map((c) => <th key={c.h} className={c.r ? 'r' : ''}>{c.h}</th>)}</tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={cols.length}><Skeleton width="100%" height={24} /></td></tr>
            ) : latestOrders.length === 0 ? (
              <tr><td colSpan={cols.length} className="rda-empty">{loadError ? 'Could not load orders.' : 'No orders yet.'}</td></tr>
            ) : latestOrders.map((o) => (
              <tr key={o.order_id || o.id || o.order_number}>
                {cols.map((c) => <td key={c.h} className={`${c.r ? 'r' : ''} ${c.mono ? 'mono' : ''}`}>{c.cell(o)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="dash-page w-full rda-page">
      <div className="dash-container flex flex-col gap-4">
        <div className="rda-head">
          <div>
            <h1>{heading}</h1>
            <p>{subline}</p>
            {isOfficeView && fieldStats && (fieldStats.active || fieldStats.visitsToday != null) && (
              <div className="rda-subnums">
                {fieldStats.active && <span><b>{fieldStats.active.on}</b> / {fieldStats.active.total} salesmen in the field</span>}
                {fieldStats.visitsToday != null && <span><b>{fieldStats.visitsToday}</b> visit{fieldStats.visitsToday === 1 ? '' : 's'} today</span>}
              </div>
            )}
          </div>
          {isOfficeView && (
            <div className="rda-seg" role="group" aria-label="Period">
              {RANGES.map(([k, label]) => (
                <button key={k} type="button" className={range === k ? 'on' : ''} aria-pressed={range === k} onClick={() => setRange(k)}>{label}</button>
              ))}
            </div>
          )}
          {quickActions.length > 0 && (
            <div className="rda-actions">
              {quickActions.map((q) => (
                <button key={q.label} type="button" onClick={q.onClick} className={q.primary ? 'rda-btn' : 'rda-btn rda-btn--ghost'}>
                  <q.icon size={16} aria-hidden="true" />{q.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isSalesman && targets.length > 0 && (
          <div className="dash-row">
            <section className="target-ring col-span-full" aria-label="Target progress">
              <svg className="target-ring__svg" width="88" height="88" viewBox="0 0 84 84" role="img" aria-label={`${targetPct} percent of target reached`}>
                <circle cx="42" cy="42" r="34" fill="none" stroke="#3b3b3b" strokeWidth="9" />
                <circle cx="42" cy="42" r="34" fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${Math.min(1, targetDone / (targetTotal || 1)) * RING_C} ${RING_C}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" style={{ fontFamily: 'var(--font-display)' }}>{targetPct}%</text>
              </svg>
              <div className="target-ring__text">
                <span className="target-ring__label">Target</span>
                <span className="target-ring__big">{money(targetDone)}</span>
                <span className="target-ring__sub">of {money(targetTotal)}. Cancelled orders still count.</span>
              </div>
            </section>
          </div>
        )}

        {isSalesman && shopParty && (
          <section className="rda-shop" aria-label="Nearest shop">
            <div>
              <h3>{shopParty.party_name || shopParty.name}</h3>
              <span>{[shopCity, shopKm != null ? `${shopKm} km away` : null].filter(Boolean).join(', ') || 'Shop location saved'}</span>
            </div>
            <button type="button" className="rda-shop__at" onClick={go('/dashboard/party')}><FiNavigation2 size={18} aria-hidden="true" />I'm at the shop</button>
            <button type="button" className="rda-btn rda-btn--ghost rda-shop__new" onClick={go('/products')}><FiShoppingCart size={16} aria-hidden="true" />New order</button>
          </section>
        )}

        <div className="dash-row dash-kpis rda-kpis" aria-label="Key figures">
          {kpis.map((k) => {
            const sm = k.money != null ? shortMoney(k.money) : null;
            return (
              <div key={k.label} className="dash-card metric rda-kpi">
                <div className="rda-kpi__lab"><span>{k.label}</span><k.icon size={18} aria-hidden="true" /></div>
                <div className="metric-value rda-kpi__num" title={k.money != null ? money(k.money) : undefined}>
                  {loading ? <Skeleton width={90} height={28} /> : sm ? <><small>{sm.sym}</small>{sm.num}</> : k.value}
                </div>
                <div className="metric-sub rda-kpi__delta">
                  {k.delta && <span className={k.delta.dir}>{k.delta.text}</span>}
                  {k.subTone ? <span className={k.subTone}>{k.sub}</span> : (k.deltaText && k.delta ? k.deltaText : k.sub)}
                </div>
              </div>
            );
          })}
        </div>

        {isOfficeView && (
          <div className="rda-cols">
            <section className="rda-card" aria-label="Orders per day">
              <div className="rda-card__head">
                <div><h3>Orders per day</h3><p>{ordersChart.sub}. Cancelled orders are not counted.</p></div>
                <div className="rda-legend" aria-hidden="true">
                  <span><i style={{ background: '#c2c2c2' }} />Earlier</span>
                  <span><i style={{ background: '#0a0a0a' }} />{range === 'today' ? 'Now' : range === 'year' ? 'This month' : 'Today'}</span>
                </div>
              </div>
              <OrdersPerDayChart data={ordersChart.buckets} height={215} ariaLabel={`Bar chart of orders. ${ordersChart.total} orders. ${ordersChart.sub}.`} />
            </section>

            <section className="needs-attention rda-card" aria-label="Needs attention">
              <div className="rda-card__head">
                <div><h3>Needs attention</h3><p>Things only a person can decide</p></div>
              </div>
              <div className="needs-attention__list">
                {attention.length === 0 && <p className="rda-empty">{loading ? 'Checking...' : 'Nothing needs your attention right now.'}</p>}
                {attention.map((a) => (
                  <button key={a.title} type="button" onClick={a.onClick} className={`needs-attention__item needs-attention__item--${a.tone}`}>
                    <span className="needs-attention__icon" aria-hidden="true"><a.icon size={18} /></span>
                    <span className="needs-attention__text">
                      <span className="needs-attention__title">{a.title}</span>
                      <span className="needs-attention__desc">{a.desc}</span>
                    </span>
                    <FiChevronRight size={16} aria-hidden="true" className="needs-attention__go" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {isOfficeView && (
          <div className={`rda-cols rda-cols--even${targetRows.length === 0 ? ' rda-cols--one' : ''}`}>
            {targetRows.length > 0 && (
              <section className="rda-card" aria-label="Salesmen against target">
                <div className="rda-card__head">
                  <div><h3>Salesmen against target</h3><p>By order value</p></div>
                  <a href="/dashboard/salesmen" className="rda-link">All salesmen</a>
                </div>
                <div className="rda-tw">
                  <table className="rda-table">
                    <thead><tr><th>Salesman</th><th>Target</th><th>Progress</th><th className="r">Done</th></tr></thead>
                    <tbody>
                      {targetRows.map((r) => {
                        const pct = Math.round((r.done / r.target) * 100);
                        return (
                          <tr key={r.id}>
                            <td><div className="rda-who"><span className="rda-pic">{initialsOf(r.name)}</span>{r.name}</div></td>
                            <td>{shortMoney(r.target).sym} {shortMoney(r.target).num}</td>
                            <td><div className="rda-prog" role="img" aria-label={`${pct} percent`}><i className={pct >= 100 ? 'hit' : ''} style={{ width: `${Math.min(100, pct)}%` }} /></div></td>
                            <td className="r">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {ordersCard('Latest orders', 'Newest first', 'All orders', [
              { h: 'Order', cell: (o) => <b>{orderRef(o)}</b>, mono: true },
              { h: 'Party', cell: partyOf },
              { h: 'Status', cell: (o) => statusPill(o.order_status) },
              { h: 'Amount', r: true, cell: (o) => money(amountOf(o)) },
            ])}
          </div>
        )}

        {isSalesman && (
          <div className="rda-cols rda-cols--even">
            <section className="rda-card" aria-label="My parties">
              <div className="rda-card__head">
                <div><h3>My parties</h3><p>Open one to capture its shop location</p></div>
                <a href="/dashboard/party" className="rda-link">All parties</a>
              </div>
              <div className="rda-tw">
                <table className="rda-table">
                  <thead><tr><th>Party</th><th>City</th><th>Location</th><th className="r">Action</th></tr></thead>
                  <tbody>
                    {ownParties.length === 0 ? (
                      <tr><td colSpan={4} className="rda-empty">{loading ? 'Loading...' : 'No parties yet.'}</td></tr>
                    ) : ownParties.slice(0, 5).map((p) => {
                      const has = p.latitude != null && p.longitude != null;
                      return (
                        <tr key={p.party_id || p.id}>
                          <td><b>{p.party_name || p.name}</b></td>
                          <td>{p.city?.name || p.city_name || (typeof p.city === 'string' ? p.city : '') || '-'}</td>
                          <td><span className={`rda-pill ${has ? 'ok' : 'idle'}`}>{has ? 'Saved' : 'Missing'}</span></td>
                          <td className="r"><a href="/dashboard/party" className="rda-btn rda-btn--sm rda-btn--ghost">{has ? 'View' : 'Add'}</a></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            {ordersCard('My latest orders', null, 'All orders', [
              { h: 'Order', cell: (o) => <b>{orderRef(o)}</b>, mono: true },
              { h: 'Party', cell: partyOf },
              { h: 'Status', cell: (o) => statusPill(o.order_status) },
              { h: 'Amount', r: true, cell: (o) => money(amountOf(o)) },
            ])}
          </div>
        )}

        {isDistributor && (
          <div className="rda-cols rda-cols--even">
            <section className="rda-card" aria-label="My parties">
              <div className="rda-card__head">
                <div><h3>My parties</h3></div>
                <a href="/dashboard/party" className="rda-link">All parties</a>
              </div>
              <div className="rda-tw">
                <table className="rda-table">
                  <thead><tr><th>Party</th><th>City</th><th className="r">Orders</th></tr></thead>
                  <tbody>
                    {ownParties.length === 0 ? (
                      <tr><td colSpan={3} className="rda-empty">{loading ? 'Loading...' : 'No parties yet.'}</td></tr>
                    ) : ownParties.slice(0, 6).map((p) => {
                      const pid = p.party_id || p.id;
                      return (
                        <tr key={pid}>
                          <td><b>{p.party_name || p.name}</b></td>
                          <td>{p.city?.name || p.city_name || (typeof p.city === 'string' ? p.city : '') || '-'}</td>
                          <td className="r">{orders.filter((o) => String(o.party_id || o.party?.id || '') === String(pid)).length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            {ordersCard('Orders from my parties', null, 'All orders', [
              { h: 'Order', cell: (o) => <b>{orderRef(o)}</b>, mono: true },
              { h: 'Party', cell: partyOf },
              { h: 'Status', cell: (o) => statusPill(o.order_status) },
            ])}
          </div>
        )}

        {isParty && (
          <>
            {ordersCard('My orders', null, 'All orders', [
              { h: 'Order', cell: (o) => <b>{orderRef(o)}</b>, mono: true },
              { h: 'Placed', cell: (o) => { const d = o.created_at || o.order_date; return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'; } },
              { h: 'Status', cell: (o) => statusPill(o.order_status) },
              { h: 'Amount', r: true, cell: (o) => <b>{money(amountOf(o))}</b> },
            ])}
            <div className="rda-lock">
              <FiClock size={16} aria-hidden="true" />
              <span>Credit days, GSTIN and PAN are changed by your manager. Contact your salesman to update them.</span>
            </div>
          </>
        )}

        {!isSalesman && (
        <div className="dash-row grid grid-cols-12 gap-4 max-[560px]:grid-cols-1 max-[560px]:gap-3">
          <div className="dash-card col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="card-title text-text text-[var(--text-md)] font-semibold leading-tight tracking-[-0.01em] mb-3">{ownData ? 'Most Ordered by You' : 'Top Selling Products'}</h4>
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
          {ownData ? (
          <div className="dash-card col-span-6 max-[560px]:col-span-full bg-surface border border-border rounded-lg shadow-sm p-5">
            <h4 className="card-title text-text text-[var(--text-md)] font-semibold leading-tight tracking-[-0.01em] mb-3">Open Orders</h4>
            <div className="mini-list">
              {stats.openOrders.length === 0 ? (
                loadError ? backendDownState : (
                <div className="ui-state ui-state--empty">
                  <p className="ui-state__title">No open orders</p>
                  <p className="ui-state__desc">Orders that are not completed yet will show here.</p>
                </div>
                )
              ) : [...stats.openOrders]
                  .sort((a, b) => new Date(b.created_at || b.order_date || 0) - new Date(a.created_at || a.order_date || 0))
                  .slice(0, 5)
                  .map((o) => (
                <div key={o.order_id || o.id || o.order_number} className="row grid grid-cols-[1fr_auto] items-center gap-3 py-3 border-b border-border last:border-b-0">
                  <div className="name text-text font-medium text-[var(--text-sm)] leading-snug">
                    {o.order_number || `#${String(o.order_id || o.id || '').slice(-6)}`}
                    <span className="ml-2 text-text-muted text-[var(--text-xs)]">{String(o.order_status || 'pending').toUpperCase()}</span>
                  </div>
                  <div className="units text-text-muted text-[var(--text-xs)] [font-variant-numeric:tabular-nums]">{money(amountOf(o))}</div>
                </div>
              ))}
            </div>
          </div>
          ) : (
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
          )}
        </div>
        )}

        {/* Order Overview: the full table with search, sort and paging */}
        <div className="dash-row rda-overview">
          <div className="dash-card full">
            <TableWithControls
              title="Order Overview"
              itemName="Order"
              rows={recentOrders}
              loading={loading}
              selectable={false}
              columns={[
                { key: 'order_number', label: 'ORDER ID', render: (v, row) => v || `#${String(row.order_id || row.id || '').slice(-6)}` },
                { key: 'order_type', label: 'ORDER TYPE', render: (v) => (v || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'N/A' },
                { key: 'party', label: 'PARTY', render: (_, row) => row.party?.party_name || row.party_name || row.party?.name || partyNamesMap[row.party_id] || '-' },
                { key: 'order_status', label: 'STATUS', render: (v) => { const st = v || 'pending'; return <StatusBadge status={String(st).toLowerCase().replace(/\s+/g, '-')}>{String(st).toUpperCase()}</StatusBadge>; } },
                { key: 'order_total', label: 'VALUE', render: (v, row) => `₹${parseFloat(v || row.total_value || row.total_amount || 0).toLocaleString('en-IN')}` },
                { key: 'created_at', label: 'DATE', render: (v, row) => { const d = v || row.order_date; return d ? new Date(d).toLocaleDateString('en-GB') : '-'; } },
              ]}
            />
          </div>
        </div>

        {/* Salesman targets */}
        {isSalesman && (
          <div className="dash-row">
            <div className="dash-card full">
              <TableWithControls
                title="My Targets"
                itemName="Target"
                rows={targets}
                loading={targetsLoading}
                selectable={false}
                columns={[
                  { key: 'target_amount', label: 'TARGET AMOUNT', render: (v) => `₹${parseFloat(v || 0).toLocaleString('en-IN')}` },
                  { key: 'start_date', label: 'START DATE', render: (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' },
                  { key: 'end_date', label: 'END DATE', render: (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-' },
                  { key: 'order_type', label: 'ORDER TYPE', render: (v) => v || 'Overall' },
                  { key: 'target_status', label: 'STATUS', render: (v) => <StatusBadge status={(v || 'pending') === 'pending' ? 'pending' : 'completed'}>{v || 'pending'}</StatusBadge> },
                  { key: 'target_description', label: 'DESCRIPTION', render: (v) => v || '-' },
                  { key: 'target_remarks', label: 'REMARKS', render: (v) => v || '-' },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
