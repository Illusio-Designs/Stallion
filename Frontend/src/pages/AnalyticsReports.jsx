import React, { useEffect, useMemo, useState } from 'react';
import '../styles/pages/dashboard-analytics.css';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Skeleton from '../components/ui/Skeleton';
import MatchMeter from '../components/ui/MatchMeter';
import {
  getAllSalesmanTargets,
  getSalesmanTargets,
  getSalesmanCheckinsPage,
  getSalesmanCheckins,
  getSalesmanProfile,
  getMyOrdersPage,
  getOrdersPage,
} from '../services/apiService';

// Rows to load per report list (check-ins + orders). Older rows load on demand.
const REPORT_LIMIT = 20; // page size; more rows load on demand via "Load more"
import { getUser, getUserRole } from '../services/authService';
import { showError } from '../services/notificationService';
import { downloadCsv } from '../utils/exportCsv';

const TABS = [
  { key: 'targets', label: 'Target Achievement' },
  { key: 'checkins', label: 'Visit Report' },
];

const PERIODS = [
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'Year' },
];
// Start of the chosen period (end is always now).
const periodStart = (key) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (key === '7d') d.setDate(d.getDate() - 6);
  else if (key === 'month') d.setDate(1);
  else { d.setMonth(0); d.setDate(1); }
  return d;
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Geofence radius (mirror of backend GEOFENCE_RADIUS_M) + Haversine distance in
// metres, used to verify a recorded visit's GPS against the party's address.
const GEOFENCE_RADIUS_M = 50;
const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};
const titleCase = (s) =>
  s ? String(s).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—';

// Inline achievement progress bar
const Progress = ({ pct }) => {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const color = v >= 50 ? '#0a0a0a' : '#8c8c8c';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-[6px] rounded-[999px] bg-[var(--color-grey-200)] overflow-hidden">
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span className="text-xs font-semibold text-text min-w-[34px] text-right">{v}%</span>
    </div>
  );
};

// Turn visit ORDERS into Visit Report rows, skipping any already linked by a
// check-in (order_id).
const visitOrdersToRows = (orders, existing) => {
  const linked = new Set((existing || []).map((x) => x.order_id).filter(Boolean));
  return (orders || [])
    .filter((o) => o.order_type === 'visit_order' && !linked.has(o.order_id || o.id))
    .map((o) => {
          // The backend already computes total_qty robustly (order_items may be a
          // JSON string), so trust it and only fall back to a local sum.
          let its = o.order_items;
          if (typeof its === 'string') { try { its = JSON.parse(its); } catch { its = []; } }
          if (its && typeof its === 'object' && !Array.isArray(its)) its = Object.values(its);
          const localQty = Array.isArray(its)
            ? its.reduce((s, it) => s + (Number(it && (it.quantity ?? it.qty)) || 0), 0)
            : 0;
          const qty = o.total_qty != null ? Number(o.total_qty) : localQty;
          return {
            id: `order-${o.order_id || o.id}`,
            type: 'ordered',
            salesman_id: o.salesman_id,
            salesman_name: o.salesman_name,
            party_id: o.party_id,
            party_name: o.party_name,
            party_latitude: o.party_latitude,
            party_longitude: o.party_longitude,
            order_id: o.order_id || o.id,
            order_total: o.order_total,
            order_qty: qty,
            order_notes: o.order_notes,
            check_in_date: o.order_date || o.created_at || o.createdAt,
            latitude: o.latitude,
            longitude: o.longitude,
          };
    });
};

const AnalyticsReports = () => {
  const [activeTab, setActiveTab] = useState('targets');
  const [targets, setTargets] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Visit Report server paging (check-ins + visit orders are fetched page by page).
  const [visitPage, setVisitPage] = useState(1);
  const [visitMore, setVisitMore] = useState({ checkins: false, orders: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const [period, setPeriod] = useState('year');

  const userRole = useMemo(() => getUserRole(), []);
  const user = useMemo(() => getUser(), []);
  const isSalesman = userRole === 'salesman';
  const salesmanId = user?.salesman_id || user?.salesmanId;

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(false);
    const asArray = (r) => (Array.isArray(r) ? r : r?.data || []);
    const isNotFound = (e) =>
      e?.statusCode === 404 ||
      `${e?.message || ''} ${e?.errorData?.error || ''}`.toLowerCase().includes('not found');

    // A salesman must see ONLY their own data. The stored user object usually
    // lacks salesman_id, so resolve it from the salesman profile (GET /salesmen)
    // before fetching. If it can't be resolved, show empty — never the all list.
    let sid = salesmanId;
    if (isSalesman && !sid) {
      try {
        const profile = await getSalesmanProfile();
        const rec = profile?.data || profile;
        sid = rec?.salesman_id || rec?.id || null;
      } catch { /* no profile -> empty, never all */ }
    }

    // Independent calls: an empty table (404) or one failing call must not break the other.
    const [tRes, cRes] = await Promise.allSettled([
      isSalesman ? (sid ? getSalesmanTargets(sid) : Promise.resolve([])) : getAllSalesmanTargets(),
      isSalesman ? (sid ? getSalesmanCheckins(sid) : Promise.resolve([])) : getSalesmanCheckinsPage(1, REPORT_LIMIT),
    ]);

    let realError = false;
    let t = [];
    let c = [];
    if (tRes.status === 'fulfilled') t = asArray(tRes.value);
    else if (!isNotFound(tRes.reason)) { realError = true; console.error('targets load failed:', tRes.reason); }
    let moreCheckins = false;
    if (cRes.status === 'fulfilled') {
      c = asArray(cRes.value);
      const pg = cRes.value && cRes.value.pagination;
      moreCheckins = !!(pg && pg.page < pg.totalPages);
    }
    else if (!isNotFound(cRes.reason)) { realError = true; console.error('check-ins load failed:', cRes.reason); }

    // Visit ORDERS live in the orders table and don't create a check-in, so they
    // would be missing from the Visit Report. Merge them in as "ordered" rows,
    // skipping any order already linked by a check-in (order_id).
    let moreOrders = false;
    try {
      const ordersRes = isSalesman
        ? await getMyOrdersPage(1, REPORT_LIMIT)
        : await getOrdersPage(1, REPORT_LIMIT);
      const opg = ordersRes && ordersRes.pagination;
      moreOrders = !!(opg && opg.page < opg.totalPages);
      c = [...c, ...visitOrdersToRows(asArray(ordersRes), c)];
    } catch (e) { console.error('Failed to merge visit orders:', e); }

    setTargets(t);
    setCheckins(c);
    setVisitPage(1);
    setVisitMore({ checkins: moreCheckins, orders: moreOrders });
    setLoadError(realError);
    if (realError) showError('Could not load some reports.');

    // Names + party coordinates now arrive embedded on every target / check-in /
    // order row from the backend (one call per report), so build the lookup maps
    // straight from those rows — no per-id salesman/party fetches.
    const salesmanMap = {};
    [...t, ...c].forEach((x) => {
      if (x.salesman_id && x.salesman_name && !salesmanMap[x.salesman_id]) {
        salesmanMap[x.salesman_id] = { salesman_id: x.salesman_id, full_name: x.salesman_name };
      }
    });
    const partyMap = {};
    c.forEach((x) => {
      if (x.party_id && !partyMap[x.party_id]) {
        partyMap[x.party_id] = {
          party_id: x.party_id,
          party_name: x.party_name || null,
          latitude: x.party_latitude != null ? x.party_latitude : null,
          longitude: x.party_longitude != null ? x.party_longitude : null,
        };
      }
    });
    setSalesmen(Object.values(salesmanMap));
    setParties(Object.values(partyMap));

    setLoading(false);
  };

  // Load the next page of the Visit Report (check-ins + visit orders) and append.
  const loadMoreVisits = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = visitPage + 1;
    const asArray = (r) => (Array.isArray(r) ? r : r?.data || []);
    try {
      const [cRes, oRes] = await Promise.allSettled([
        visitMore.checkins ? getSalesmanCheckinsPage(next, REPORT_LIMIT) : Promise.resolve(null),
        visitMore.orders ? (isSalesman ? getMyOrdersPage(next, REPORT_LIMIT) : getOrdersPage(next, REPORT_LIMIT)) : Promise.resolve(null),
      ]);
      const hasMore = { checkins: false, orders: false };
      let added = [];
      if (cRes.status === 'fulfilled' && cRes.value) {
        added = added.concat(asArray(cRes.value));
        const pg = cRes.value.pagination;
        hasMore.checkins = !!(pg && pg.page < pg.totalPages);
      }
      const base = [...checkins, ...added];
      if (oRes.status === 'fulfilled' && oRes.value) {
        added = added.concat(visitOrdersToRows(asArray(oRes.value), base));
        const pg = oRes.value.pagination;
        hasMore.orders = !!(pg && pg.page < pg.totalPages);
      }
      if (cRes.status === 'rejected' || oRes.status === 'rejected') showError('Could not load more visits.');
      setCheckins((prev) => {
        const seen = new Set(prev.map((x) => x.id).filter(Boolean));
        return [...prev, ...added.filter((x) => !(x.id && seen.has(x.id)))];
      });
      // Keep the name / location lookups in step with the newly added rows.
      setSalesmen((prev) => {
        const m = new Map(prev.map((x) => [String(x.salesman_id), x]));
        added.forEach((x) => { if (x.salesman_id && x.salesman_name && !m.has(String(x.salesman_id))) m.set(String(x.salesman_id), { salesman_id: x.salesman_id, full_name: x.salesman_name }); });
        return [...m.values()];
      });
      setParties((prev) => {
        const m = new Map(prev.map((x) => [String(x.party_id), x]));
        added.forEach((x) => { if (x.party_id && !m.has(String(x.party_id))) m.set(String(x.party_id), { party_id: x.party_id, party_name: x.party_name || null, latitude: x.party_latitude != null ? x.party_latitude : null, longitude: x.party_longitude != null ? x.party_longitude : null }); });
        return [...m.values()];
      });
      setVisitPage(next);
      setVisitMore(hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const salesmanName = (id) => {
    const s = salesmen.find((x) => String(x.salesman_id || x.id) === String(id));
    return s?.full_name || s?.name || (id ? `Salesman ${String(id).slice(0, 8)}` : 'N/A');
  };
  const partyName = (id) => {
    if (!id) return '—';
    const p = parties.find((x) => String(x.party_id || x.id) === String(id));
    return p?.party_name || p?.name || `Party ${String(id).slice(0, 8)}`;
  };
  // The party's geocoded address coordinates (for verifying a recorded visit).
  const partyCoords = (id) => {
    if (!id) return null;
    const p = parties.find((x) => String(x.party_id || x.id) === String(id));
    if (p && p.latitude != null && p.longitude != null) return { lat: Number(p.latitude), lng: Number(p.longitude) };
    return null;
  };

  // Period filter (by date): targets that overlap the period, visits inside it.
  const periodRange = useMemo(() => ({ from: periodStart(period), to: new Date() }), [period]);
  const periodTargets = useMemo(() => targets.filter((t) => {
    if (!t.start_date && !t.end_date) return true;
    const s = t.start_date ? new Date(t.start_date) : null;
    const e = t.end_date ? new Date(t.end_date) : null;
    if (e && !isNaN(e) && e < periodRange.from) return false;
    if (s && !isNaN(s) && s > periodRange.to) return false;
    return true;
  }), [targets, periodRange]);
  const periodCheckins = useMemo(() => checkins.filter((c) => {
    if (!c.check_in_date) return true;
    const d = new Date(c.check_in_date);
    return isNaN(d) || (d >= periodRange.from && d <= periodRange.to);
  }), [checkins, periodRange]);

  // ---- Target summary (real data) ----
  const summary = useMemo(() => {
    const total = periodTargets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
    const achieved = periodTargets.reduce((s, t) => s + (Number(t.completed_amount) || 0), 0);
    const due = Math.max(0, total - achieved);
    const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;
    return { total, achieved, due, pct };
  }, [periodTargets]);

  // Achieved amount per salesman (display only, from the same targets list).
  const bySalesman = useMemo(() => {
    const sums = {};
    periodTargets.forEach((t) => {
      const id = t.salesman_id || 'na';
      sums[id] = (sums[id] || 0) + (Number(t.completed_amount) || 0);
    });
    const list = Object.keys(sums).map((id) => ({ id, name: salesmanName(id === 'na' ? null : id), amount: sums[id] }))
      .sort((a, b) => b.amount - a.amount).slice(0, 8);
    const max = list.reduce((m, r) => Math.max(m, r.amount), 0);
    return list.map((r) => ({ ...r, pct: max > 0 ? Math.round((r.amount / max) * 100) : 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodTargets, salesmen]);

  const targetColumns = useMemo(() => ([
    { key: 'salesman', label: 'SALESMAN', width: '150px' },
    { key: 'period', label: 'PERIOD', width: '200px' },
    { key: 'type', label: 'ORDER TYPE', width: '120px' },
    { key: 'target', label: 'TARGET', width: '110px' },
    { key: 'achieved', label: 'ACHIEVED', width: '110px' },
    { key: 'progress', label: 'PROGRESS', width: '160px', render: (v) => <Progress pct={v} /> },
    { key: 'status', label: 'STATUS', width: '110px', render: (v) => <StatusBadge status={String(v).toLowerCase()}>{String(v).toUpperCase()}</StatusBadge> },
  ]), []);

  const targetRows = useMemo(() => periodTargets.map((t, i) => {
    const target = Number(t.target_amount) || 0;
    const achieved = Number(t.completed_amount) || 0;
    return {
      id: t.id || i,
      salesman: salesmanName(t.salesman_id),
      period: `${fmtDate(t.start_date)} – ${fmtDate(t.end_date)}`,
      type: t.order_type ? titleCase(t.order_type) : 'Overall',
      target: money(target),
      achieved: money(achieved),
      progress: target > 0 ? (achieved / target) * 100 : 0,
      status: t.target_status || 'pending',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [periodTargets, salesmen]);

  const checkinColumns = useMemo(() => ([
    { key: 'type', label: 'TYPE', render: (v) => (
      <StatusBadge status={v === 'ordered' ? 'completed' : 'processing'}>{v === 'ordered' ? 'Order' : 'Visit'}</StatusBadge>
    ) },
    { key: 'salesman', label: 'SALESMAN' },
    { key: 'party', label: 'PARTY' },
    { key: 'date', label: 'DATE' },
    { key: 'location', label: 'LOCATION', render: (v) => {
      if (!v || v.lat == null || v.lng == null) return <span className="text-text-subtle">—</span>;
      const href = `https://www.google.com/maps?q=${v.lat},${v.lng}`;
      if (!v.party) {
        return (
          <span className="inline-flex items-center gap-2">
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary font-medium">View on map</a>
            <span className="text-text-subtle text-xs">(party location not set)</span>
          </span>
        );
      }
      const dist = distanceMeters(v.lat, v.lng, v.party.lat, v.party.lng);
      return <MatchMeter distance={dist} radius={GEOFENCE_RADIUS_M} href={href} />;
    } },
    { key: 'qty', label: 'QTY' },
    { key: 'amount', label: 'AMOUNT' },
    { key: 'reason', label: 'REASON' },
  ]), []);

  const checkinRows = useMemo(() => [...periodCheckins]
    .sort((a, b) => new Date(b.check_in_date || 0) - new Date(a.check_in_date || 0))
    .map((c, i) => ({
      id: c.id || i,
      type: c.type || 'visit',
      salesman: salesmanName(c.salesman_id),
      party: c.party_name || partyName(c.party_id),
      date: fmtDate(c.check_in_date),
      location: { lat: c.latitude, lng: c.longitude, party: partyCoords(c.party_id) },
      qty: c.type === 'ordered' && c.order_qty != null ? Number(c.order_qty).toLocaleString('en-IN') : '—',
      amount: c.type === 'ordered' && c.order_total != null ? money(c.order_total) : '—',
      // Ordered rows carry the order note (order_notes); visits use check_in_remarks.
      reason: (c.type === 'ordered' ? (c.order_notes || c.check_in_remarks) : c.check_in_remarks) || '—',
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodCheckins, salesmen, parties]);

  const exportVisible = () => {
    if (activeTab === 'targets') {
      downloadCsv('target-achievement', [
        { label: 'Salesman', value: (r) => r.salesman },
        { label: 'Period', value: (r) => r.period },
        { label: 'Order type', value: (r) => r.type },
        { label: 'Target', value: (r) => r.target },
        { label: 'Achieved', value: (r) => r.achieved },
        { label: 'Progress %', value: (r) => Math.round(r.progress) },
        { label: 'Status', value: (r) => r.status },
      ], targetRows);
    } else {
      downloadCsv('visit-report', [
        { label: 'Type', value: (r) => (r.type === 'ordered' ? 'Order' : 'Visit') },
        { label: 'Salesman', value: (r) => r.salesman },
        { label: 'Party', value: (r) => r.party },
        { label: 'Date', value: (r) => r.date },
        { label: 'Quantity', value: (r) => r.qty },
        { label: 'Amount', value: (r) => r.amount },
        { label: 'Reason', value: (r) => r.reason },
      ], checkinRows);
    }
  };
  const visibleCount = activeTab === 'targets' ? targetRows.length : checkinRows.length;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label || '';

  const backendDown = (
    <div className="ui-state ui-state--error">
      <div className="ui-state__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" />
          <line x1="6" y1="7" x2="6.01" y2="7" /><line x1="6" y1="17" x2="6.01" y2="17" />
        </svg>
      </div>
      <p className="ui-state__title">Backend not working</p>
      <p className="ui-state__desc">We couldn't load the reports. Please try again.</p>
      <button className="ui-btn ui-btn--secondary" onClick={fetchAll}>Try again</button>
    </div>
  );

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        <div className="pg-head">
          <div><h1>Reports</h1><p>{fmtDate(periodRange.from)} to {fmtDate(periodRange.to)}. Cancelled orders count toward salesman targets.</p></div>
          <div className="pg-head__tools">
            <div className="seg rep-seg" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p.key} type="button" aria-pressed={period === p.key} className={period === p.key ? 'on' : ''} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
            <button type="button" className="gbtn rep-export" onClick={exportVisible} disabled={loading || visibleCount === 0}>Export CSV</button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="dash-row">
          <div className="order-tabs-container col-[1/-1] flex w-full gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[length:var(--text-base)] font-semibold leading-snug transition-colors active:scale-[0.98] ${activeTab === tab.key ? 'active bg-primary text-white' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== Target Achievement ===== */}
        {activeTab === 'targets' && (
          <>
            <div className="dash-row analytics-summary grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              {[
                { label: 'Total Target', value: money(summary.total) },
                { label: 'Achieved', value: money(summary.achieved) },
                { label: 'Due', value: money(summary.due) },
                { label: 'Completed %', value: `${summary.pct}%` },
              ].map((card) => (
                <div key={card.label} className="dash-card metric analytics-card flex flex-col gap-1 bg-surface border border-border rounded-lg shadow-sm p-5 col-span-1 sm:col-span-6 lg:col-span-3">
                  <h4 className="m-0 text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">{card.label}</h4>
                  <div className="metric-value text-xl font-bold leading-tight tracking-[-0.01em] text-text tabular-nums">
                    {loading ? <Skeleton width={90} height={24} /> : card.value}
                  </div>
                </div>
              ))}
            </div>

            {!loading && bySalesman.length > 0 && (
              <div className="dash-row">
                <div className="dash-card full an-bars">
                  <h3 className="an-bars__title">Achieved by salesman</h3>
                  <ul className="an-bars__list">
                    {bySalesman.map((r) => (
                      <li key={r.id} className="an-bars__row">
                        <span className="an-bars__name">{r.name}</span>
                        <span className="prog" role="img" aria-label={`${r.name}: ${money(r.amount)}`}><i style={{ width: `${r.pct}%` }} /></span>
                        <b className="an-bars__val">{money(r.amount)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="dash-row">
              <div className="dash-card full">
                {loadError && !loading ? backendDown : (!loading && targetRows.length === 0) ? (
                  <div className="ui-state ui-state--empty">
                    <p className="ui-state__title">{targets.length ? `No targets in ${periodLabel.toLowerCase()}` : 'No targets yet'}</p>
                    <p className="ui-state__desc">{targets.length ? 'Pick a longer period to see more.' : 'Salesman targets and their achievement will show here once created.'}</p>
                  </div>
                ) : (
                  <TableWithControls title="Target Achievement" columns={targetColumns} rows={targetRows} itemName="Target" loading={loading} selectable={false} />
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== Salesman Check-ins ===== */}
        {activeTab === 'checkins' && (
          <div className="dash-row">
            <div className="dash-card full">
              {loadError && !loading ? backendDown : (!loading && checkinRows.length === 0) ? (
                <div className="ui-state ui-state--empty">
                  <p className="ui-state__title">{checkins.length ? `No visits in ${periodLabel.toLowerCase()}` : 'No visit reports yet'}</p>
                  <p className="ui-state__desc">{checkins.length ? 'Pick a longer period to see more.' : 'Salesman visit reports (with party and location) will show here.'}</p>
                </div>
              ) : (
                <>
                  <TableWithControls title="Visit Report" columns={checkinColumns} rows={checkinRows} itemName="Visit Report" loading={loading} selectable={false} />
                  {!loading && (
                    <div className="ui-state__desc" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', padding: '12px 0' }}>
                      <span>
                        {(visitMore.checkins || visitMore.orders)
                          ? `Showing the latest ${checkinRows.length} visits — older visits are not loaded yet.`
                          : `Showing all ${checkinRows.length} visits.`}
                      </span>
                      {(visitMore.checkins || visitMore.orders) && (
                        <button type="button" className="ui-pill" onClick={loadMoreVisits} disabled={loadingMore}>
                          {loadingMore ? 'Loading…' : 'Load more'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsReports;
