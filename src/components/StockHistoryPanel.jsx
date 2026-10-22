import React, { useEffect, useState } from 'react';
import AsidePanel from './ui/AsidePanel';
import Skeleton from './ui/Skeleton';
import { getProductStockHistory } from '../services/apiService';

// Every stock change of one product: what happened, by how much, the numbers after it, and who did it.
const KINDS = [['', 'All'], ['order', 'Orders'], ['cancel', 'Cancels'], ['tray', 'Trays'], ['sheet', 'Sheet uploads'], ['manual', 'Hand edits']];
const LABEL = { order: 'Order placed', cancel: 'Order cancelled', tray: 'Tray move', sheet: 'Sheet upload', manual: 'Edited by hand' };

const ago = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  if (mins < 43200) return `${Math.round(mins / 1440)} days ago`;
  return new Date(iso).toLocaleDateString('en-IN');
};
const signed = (n) => (n > 0 ? `+${n}` : String(n));

const StockHistoryPanel = ({ open, onClose, productId, modelNo }) => {
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: false, error: '', summary: null, rows: [], totalPages: 1 });
  const [openId, setOpenId] = useState(null);

  useEffect(() => { if (open) { setKind(''); setPage(1); setOpenId(null); } }, [open, productId]);

  useEffect(() => {
    if (!open || !productId) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    getProductStockHistory(productId, { kind, page, limit: 20 })
      .then((r) => {
        if (cancelled) return;
        setState({ loading: false, error: '', summary: r.summary, rows: r.data || [], totalPages: (r.pagination && r.pagination.totalPages) || 1 });
      })
      .catch((e) => { if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message || 'Could not load the history' })); });
    return () => { cancelled = true; };
  }, [open, productId, kind, page]);

  const { loading, error, summary, rows, totalPages } = state;

  return (
    <AsidePanel open={open} onClose={onClose} title={`Stock history${modelNo ? ` · ${modelNo}` : ''}`}>
      {summary && (
        <div className="sh__sum">
          <div className="sh__st sh__st--dark"><small>Total in stock</small><b>{summary.total_qty}</b></div>
          <div className="sh__st"><small>In the warehouse</small><b>{summary.warehouse_qty}</b></div>
          <div className="sh__st"><small>In sample trays</small><b>{summary.tray_qty}</b></div>
          <div className="sh__st"><small>Changes, last 30 days</small><b>{summary.moves_30_days}</b></div>
        </div>
      )}
      <div className="sh__chips" role="group" aria-label="Type of change">
        {KINDS.map(([k, l]) => (
          <button key={k || 'all'} type="button" className="sh__chip" aria-pressed={kind === k} onClick={() => { setKind(k); setPage(1); }}>{l}</button>
        ))}
      </div>
      {error ? <p className="rda-empty">{error}</p> : loading ? (
        <div className="sh__skel">{[0, 1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={52} radius={10} />)}</div>
      ) : rows.length === 0 ? (
        <p className="rda-empty">No stock changes recorded yet. History starts from the day this was switched on.</p>
      ) : (
        <ul className="sh__list">
          {rows.map((m) => {
            const before = m.warehouse_after - m.change_warehouse;
            const isOpen = openId === m.id;
            return (
              <li key={m.id}>
                <button type="button" className="sh__row" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : m.id)}>
                  <span className="sh__what">
                    <b>{LABEL[m.kind] || m.kind}</b>
                    <small>{ago(m.created_at)}{m.reference ? ` · ${m.reference}` : ''}</small>
                  </span>
                  <span className={`sh__chg ${m.change_warehouse > 0 ? 'up' : m.change_warehouse < 0 ? 'dn' : ''}`}>{signed(m.change_warehouse)}</span>
                  <span className="sh__after">{m.warehouse_after}</span>
                </button>
                {isOpen && (
                  <div className="sh__det">
                    {m.note && <p>{m.note}</p>}
                    <div className="sh__flow"><span><small>Warehouse before</small><b>{before}</b></span><span aria-hidden="true">→</span><span><small>Warehouse after</small><b>{m.warehouse_after}</b></span></div>
                    <dl>
                      <dt>Trays change</dt><dd>{signed(m.change_tray)}</dd>
                      <dt>Who</dt><dd>{m.user_name || 'System'}</dd>
                      <dt>When</dt><dd>{new Date(m.created_at).toLocaleString('en-IN')}</dd>
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {totalPages > 1 && (
        <div className="sh__pager">
          <button type="button" className="ui-btn ui-btn--secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Newer</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="ui-btn ui-btn--secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Older</button>
        </div>
      )}
    </AsidePanel>
  );
};

export default StockHistoryPanel;
