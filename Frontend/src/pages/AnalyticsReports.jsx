import React, { useEffect, useMemo, useState } from 'react';
import '../styles/pages/dashboard-analytics.css';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Skeleton from '../components/ui/Skeleton';
import {
  getAllSalesmanTargets,
  getSalesmanTargets,
  getAllSalesmanCheckins,
  getSalesmanCheckins,
  getSalesmen,
  getParties,
} from '../services/apiService';
import { getUser, getUserRole } from '../services/authService';
import { showError } from '../services/notificationService';

const TABS = [
  { key: 'targets', label: 'Target Achievement' },
  { key: 'checkins', label: 'Salesman Check-ins' },
];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const titleCase = (s) =>
  s ? String(s).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—';

// Inline achievement progress bar
const Progress = ({ pct }) => {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const color = v >= 100 ? 'var(--color-success)' : v >= 50 ? 'var(--color-primary)' : 'var(--color-warning)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--color-grey-200)', overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', minWidth: 34, textAlign: 'right' }}>{v}%</span>
    </div>
  );
};

const AnalyticsReports = () => {
  const [activeTab, setActiveTab] = useState('targets');
  const [targets, setTargets] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

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
    const emptyOnNotFound = (e) => {
      const msg = `${e?.message || ''} ${e?.errorData?.error || ''}`.toLowerCase();
      if (e?.statusCode === 404 || msg.includes('not found')) return [];
      throw e;
    };
    try {
      const [targetsData, checkinsData] = await Promise.all([
        (isSalesman && salesmanId ? getSalesmanTargets(salesmanId) : getAllSalesmanTargets()).catch(emptyOnNotFound),
        (isSalesman && salesmanId ? getSalesmanCheckins(salesmanId) : getAllSalesmanCheckins()).catch(emptyOnNotFound),
      ]);
      setTargets(asArray(targetsData));
      setCheckins(asArray(checkinsData));
      // Names — best effort, never fatal
      try { setSalesmen(asArray(await getSalesmen())); } catch { /* fall back to id */ }
      try { setParties(asArray(await getParties())); } catch { /* fall back to id */ }
    } catch (e) {
      console.error('Reports load failed:', e);
      setLoadError(true);
      showError('Could not load reports. Please try again.');
      setTargets([]);
      setCheckins([]);
    } finally {
      setLoading(false);
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

  // ---- Target summary (real data) ----
  const summary = useMemo(() => {
    const total = targets.reduce((s, t) => s + (Number(t.target_amount) || 0), 0);
    const achieved = targets.reduce((s, t) => s + (Number(t.completed_amount) || 0), 0);
    const due = Math.max(0, total - achieved);
    const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;
    return { total, achieved, due, pct };
  }, [targets]);

  const targetColumns = useMemo(() => ([
    { key: 'salesman', label: 'SALESMAN' },
    { key: 'period', label: 'PERIOD' },
    { key: 'type', label: 'ORDER TYPE' },
    { key: 'target', label: 'TARGET' },
    { key: 'achieved', label: 'ACHIEVED' },
    { key: 'progress', label: 'PROGRESS', render: (v) => <Progress pct={v} /> },
    { key: 'status', label: 'STATUS', render: (v) => <StatusBadge status={String(v).toLowerCase()}>{String(v).toUpperCase()}</StatusBadge> },
  ]), []);

  const targetRows = useMemo(() => targets.map((t, i) => {
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
  }), [targets, salesmen]);

  const checkinColumns = useMemo(() => ([
    { key: 'salesman', label: 'SALESMAN' },
    { key: 'party', label: 'PARTY' },
    { key: 'date', label: 'DATE' },
    { key: 'location', label: 'LOCATION', render: (v) => (v && v.lat && v.lng)
      ? <a href={`https://www.google.com/maps?q=${v.lat},${v.lng}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>View on map</a>
      : <span style={{ color: 'var(--color-text-subtle)' }}>—</span> },
    { key: 'remarks', label: 'REMARKS' },
  ]), []);

  const checkinRows = useMemo(() => [...checkins]
    .sort((a, b) => new Date(b.check_in_date || 0) - new Date(a.check_in_date || 0))
    .map((c, i) => ({
      id: c.id || i,
      salesman: salesmanName(c.salesman_id),
      party: partyName(c.party_id),
      date: fmtDate(c.check_in_date),
      location: { lat: c.latitude, lng: c.longitude },
      remarks: c.check_in_remarks || '—',
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkins, salesmen, parties]);

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

            <div className="dash-row">
              <div className="dash-card full">
                {loadError && !loading ? backendDown : (!loading && targetRows.length === 0) ? (
                  <div className="ui-state ui-state--empty">
                    <p className="ui-state__title">No targets yet</p>
                    <p className="ui-state__desc">Salesman targets and their achievement will show here once created.</p>
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
                  <p className="ui-state__title">No check-ins yet</p>
                  <p className="ui-state__desc">Salesman visit check-ins (with party and location) will show here.</p>
                </div>
              ) : (
                <TableWithControls title="Salesman Check-ins" columns={checkinColumns} rows={checkinRows} itemName="Check-in" loading={loading} selectable={false} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsReports;
