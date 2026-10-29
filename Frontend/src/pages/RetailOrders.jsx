'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import DateRangePicker from '../components/ui/DateRangePicker';
import StatusBadge from '../components/ui/StatusBadge';
import { FiSearch } from '../components/icons/hugeicons';
import RetailOrderPanel from '../components/retail/RetailOrderPanel';
import { PageHead, Chips, StateBox, errorText } from '../components/retail/RetailBits';
import { getRetailOrders, getRetailOrderSummary, retailData, retailList } from '../services/api/retailApi';
import { rupees, istDateTime, normalizeOrder, normalizeOrderSummary } from '../utils/retailFormat';
import { RETAIL_STATUSES, statusBadgeKey, statusLabel } from '../utils/retailOrderStatus';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const PAGE = 20;

// Online orders placed on the public store, newest first.
export default function RetailOrders() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [range, setRange] = useState({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: '' });
  const [counts, setCounts] = useState({});
  const [openId, setOpenId] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await getRetailOrders({ status: status === 'all' ? '' : status, q, from: range.from, to: range.to, page, limit: PAGE });
      if (mine !== seq.current) return;
      const { rows, pagination } = retailList(res);
      setState({ rows: rows.map(normalizeOrder), pagination, loading: false, error: '' });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: errorText(e, 'Could not load orders.') }));
    }
  }, [status, q, range.from, range.to, page]);

  useEffect(() => { load(); }, [load]);

  const loadCounts = useCallback(async () => {
    try { setCounts(normalizeOrderSummary(retailData(await getRetailOrderSummary())).counts); } catch { /* chips just show no counts */ }
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // The search box waits for a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const chips = useMemo(() => {
    const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
    return [{ value: 'all', label: 'All', count: total || undefined }, ...RETAIL_STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: counts[s] !== undefined ? counts[s] : undefined }))];
  }, [counts]);

  const columns = useMemo(() => [
    { key: 'order_number', label: 'Order', render: (v) => <span className="rt-cell-b">{v} <span className="rt-tag">Store</span></span> },
    { key: 'customer_name', label: 'Customer', render: (v, r) => <span className="rt-cell"><b>{v}</b><small>{r.customer_phone}</small></span> },
    { key: 'city', label: 'City', render: (v) => v || '—' },
    { key: 'total', label: 'Total', render: (v) => <b>{rupees(v)}</b> },
    { key: 'payment_type', label: 'Payment', render: (v, r) => (String(v || 'cod').toLowerCase() === 'cod' ? 'Cash on delivery' : `Online${r.payment_status === 'paid' ? ', paid' : ''}`) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={statusBadgeKey(v)}>{statusLabel(v)}</StatusBadge> },
    { key: 'created_at', label: 'Placed', render: (v) => istDateTime(v) },
    { key: 'actions', label: 'Action', render: (_v, r) => <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => setOpenId(r.id)} aria-label={`View order ${r.order_number}`}>View</button> },
  ], []);

  const total = state.pagination?.total ?? state.rows.length;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Online orders" subtitle="Orders placed on the public store. Times are India time." />

        <Chips options={chips} value={status} onChange={(v) => { setPage(1); setStatus(v); }} label="Filter by status" />

        <div className="rt-toolbar">
          <label className="rt-search">
            <FiSearch aria-hidden="true" />
            <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search order number, name or phone" aria-label="Search online orders" />
          </label>
          <DateRangePicker from={range.from} to={range.to} onChange={({ from, to }) => { setPage(1); setRange({ from, to }); }} />
        </div>

        {state.error && !state.loading ? (
          <StateBox kind="error" title="Could not load orders" desc={state.error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={load}>Try again</button>} />
        ) : !state.loading && state.rows.length === 0 && !q && status === 'all' && !range.from ? (
          <StateBox title="No online orders yet" desc="When a customer places an order on the store it shows up here." />
        ) : (
          <div className="dash-card full rt-table">
            <TableWithControls
              title="Orders"
              titleAs="h2"
              columns={columns}
              rows={state.rows}
              itemName="Order"
              loading={state.loading}
              selectable={false}
              showSerialNumber={false}
              serverPagination
              serverPage={page}
              serverPageCount={state.pagination?.totalPages || 1}
              serverPageSize={PAGE}
              serverTotal={total}
              onServerPageChange={setPage}
              onServerSearch={(term) => { setPage(1); setQInput(term); }}
            />
          </div>
        )}
      </div>

      <RetailOrderPanel orderId={openId} onClose={() => setOpenId(null)} onChanged={() => { load(); loadCounts(); }} />
    </div>
  );
}
