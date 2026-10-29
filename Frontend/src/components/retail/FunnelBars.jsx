'use client';
import React from 'react';
import { stepLabel, count } from '../../utils/retailFormat';
import '../../styles/redesign-p-retail.css';

/** Where visitors drop off: one bar per funnel step, as a share of the first step. */
export default function FunnelBars({ funnel = [] }) {
  const steps = Array.isArray(funnel) ? funnel : [];
  if (steps.length === 0) return <p className="rt-none">No visits recorded yet for this period.</p>;
  const first = Number(steps[0]?.count) || 0;
  return (
    <div className="rt-funnel">
      {steps.map((s, i) => {
        const pctRaw = s.pct !== undefined && s.pct !== null ? Number(s.pct) : (first ? (Number(s.count) / first) * 100 : 0);
        const pct = Math.max(0, Math.min(100, Number.isFinite(pctRaw) ? pctRaw : 0));
        const shown = pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
        return (
          <div key={s.step || i} className="rt-funnel__row">
            <div className="rt-funnel__top">
              <span>{stepLabel(s.step)}</span>
              <span><b>{count(s.count)}</b> <small>{shown}%</small></span>
            </div>
            <div className="rt-funnel__track" role="img" aria-label={`${stepLabel(s.step)}: ${shown} percent`}>
              <i style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
