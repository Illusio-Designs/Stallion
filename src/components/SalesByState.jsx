import React, { useEffect, useMemo, useState } from 'react';
import { getSalesByState } from '../services/apiService';
import Skeleton from './ui/Skeleton';

// Sales by state for the Reports page: ranked bars, a Sales / Orders switch, and the picked state's
// numbers with its top parties. The server adds the numbers up, so they cover every order in the period.
const inr = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString('en-IN')}`;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const SalesByState = ({ from, to }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [measure, setMeasure] = useState('sales');
  const [sel, setSel] = useState(null);
  const fromKey = from ? ymd(from) : '';
  const toKey = to ? ymd(to) : '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSalesByState(fromKey, toKey)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Could not load sales by state'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fromKey, toKey]);

  const states = useMemo(() => {
    const list = (data && data.states) || [];
    return [...list].sort((a, b) => b[measure] - a[measure]);
  }, [data, measure]);
  const max = Math.max(1, ...states.map((s) => s[measure]));
  const picked = states.find((s) => s.state === sel) || states[0] || null;
  const total = (data && data.total_sales) || 0;
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodText = from && to ? `${fmt(from)} to ${fmt(to)}` : '';
  const pct = (s) => (total ? Math.round((s.sales * 100) / total) : 0);

  return (
    <div className="dash-row">
      <div className="dash-card full sbs">
        <div className="sbs__head">
          <div>
            <h3>Sales by state</h3>
            {periodText && <p className="sbs__period">{periodText}, compared with the period before</p>}
          </div>
          <div className="seg rep-seg" role="group" aria-label="Measure">
            {[['sales', 'Sales'], ['orders', 'Orders']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={measure === k} className={measure === k ? 'on' : ''} onClick={() => setMeasure(k)}>{l}</button>
            ))}
          </div>
        </div>
        {error ? (
          <p className="rda-empty">{error}</p>
        ) : loading ? (
          <div className="sbs__skel">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height={28} radius={8} />)}</div>
        ) : !states.length ? (
          <p className="rda-empty">No orders in this period.</p>
        ) : (
          <div className="sbs__split">
            <div className="sbs__bars">
              {states.map((s, i) => (
                <button key={s.state} type="button" className={`sbs__row${s.state === 'No state set' ? ' sbs__row--none' : ''}`} aria-pressed={picked && picked.state === s.state} onClick={() => setSel(s.state)}>
                  <span className="sbs__rk">{i + 1}</span>
                  <b>{s.state}</b>
                  <span className="sbs__track"><span className="sbs__fill" style={{ width: `${Math.max(3, Math.round((s[measure] * 100) / max))}%` }} /></span>
                  <span className="sbs__val">
                    {measure === 'sales' ? inr(s.sales) : `${s.orders} orders`}
                    <small className="sbs__pct">{pct(s)}% of sales</small>
                    {s.change_percent !== null && s.state !== 'No state set' && (
                      <span className={`sbs__chg ${s.change_percent >= 0 ? 'up' : 'dn'}`}>{s.change_percent >= 0 ? '+' : ''}{s.change_percent}%</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {picked && (
              <div className="sbs__det" aria-live="polite">
                <h4>{picked.state}</h4>
                <p className="sbs__share">{pct(picked)}% of all sales in this period</p>
                <div className="sbs__stats">
                  <div><small>Sales</small><b>{inr(picked.sales)}</b>
                    {picked.change_percent !== null && picked.state !== 'No state set' && (
                      <span className={`sbs__chg sbs__chg--in ${picked.change_percent >= 0 ? 'up' : 'dn'}`}>{picked.change_percent >= 0 ? '+' : ''}{picked.change_percent}%</span>
                    )}
                  </div>
                  <div><small>Orders</small><b>{picked.orders}</b></div>
                  <div><small>Average order</small><b>{inr(picked.orders ? picked.sales / picked.orders : 0)}</b></div>
                  <div><small>Parties ordering</small><b>{picked.parties}</b></div>
                </div>
                {picked.top_parties.length > 0 && (
                  <table className="sbs__tbl">
                    <thead><tr><th>Top parties</th><th>Orders</th><th>Amount</th></tr></thead>
                    <tbody>{picked.top_parties.map((t) => <tr key={t.party_name}><td>{t.party_name}</td><td>{t.orders}</td><td>{inr(t.amount)}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
        <p className="sbs__note">Cancelled orders are counted, because the salesman's effort still counts. Parties with no state saved appear as "No state set".</p>
      </div>
    </div>
  );
};

export default SalesByState;
