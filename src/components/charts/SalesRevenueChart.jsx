'use client';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import '../../styles/pages/dashboard-analytics.css';

// Lightweight SVG dual-bar chart (Sales = indigo, Revenue = amber) with grid,
// axis, legend, and loading / empty states. Colors are token-driven via CSS
// classes (see dashboard-analytics.css) so the chart stays on-brand.
export default function SalesRevenueChart({
  data = [], // [{label, sales, revenue}]
  height = 260,
  loading = false,
}) {
  // Measure the actual rendered width so the SVG viewBox matches it 1:1. Without
  // this the fixed 820-wide viewBox gets scaled DOWN to fit a narrow phone,
  // shrinking the bars to half height and leaving big empty gaps.
  const wrapRef = useRef(null);
  const [measuredW, setMeasuredW] = useState(820);
  useEffect(() => {
    if (typeof window === 'undefined' || !wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => setMeasuredW(Math.max(280, Math.round(el.clientWidth) || 820));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, data.length]);

  const cfg = useMemo(() => {
    const margin = { top: 16, right: 0, bottom: 28, left: 0 };
    const width = measuredW; // match the rendered width so the viewBox isn't shrunk to fit
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Only plot series that actually carry data — avoids a lonely set of bars
    // (e.g. Revenue is 0 until orders are marked completed).
    const hasSales = data.some(d => (d.sales || 0) > 0);
    const hasRevenue = data.some(d => (d.revenue || 0) > 0);
    const series = [];
    if (hasSales) series.push({ key: 'sales', cls: 'fill-[var(--color-primary)]', label: 'Sales' });
    if (hasRevenue) series.push({ key: 'revenue', cls: 'fill-[var(--color-accent)]', label: 'Revenue' });
    if (series.length === 0) series.push({ key: 'sales', cls: 'fill-[var(--color-primary)]', label: 'Sales' });
    const count = series.length;

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.sales || 0, d.revenue || 0)));
    const visualMax = maxVal * 1.2; // a little headroom above the tallest bar

    const n = Math.max(1, data.length);
    const band = innerW / n;
    const gap = count === 2 ? Math.max(3, Math.min(8, band * 0.12)) : 0;
    const barW = count === 1
      ? Math.max(14, Math.min(34, band * 0.52))
      : Math.max(10, Math.min(20, (band * 0.62 - gap) / 2));
    const groupW = barW * count + gap * (count - 1);

    const centerX = (i) => margin.left + band * i + band / 2;
    const xOf = (i, sIdx) => centerX(i) - groupW / 2 + sIdx * (barW + gap);
    const y = (v) => margin.top + innerH - (v / visualMax) * innerH;

    const yTicksVals = [0, 0.5, 1.0].map(m => m * visualMax);
    // Compact, readable axis labels (Indian units).
    const formatK = (v) => {
      const num = Math.round(v);
      if (num >= 1e7) return `₹${(num / 1e7).toFixed(1)}Cr`;
      if (num >= 1e5) return `₹${(num / 1e5).toFixed(1)}L`;
      if (num >= 1e3) return `₹${(num / 1e3).toFixed(1)}k`;
      return `₹${num}`;
    };

    return { margin, width, height, innerW, innerH, visualMax, band, barW, xOf, y, yTicksVals, formatK, series };
  }, [data, height, measuredW]);

  const legend = (
    <div className="srchart__legend z-[1] mb-2 flex justify-end gap-4" aria-hidden="true">
      {cfg.series.map((s) => (
        <span key={s.key} className={`srchart__legend-item srchart__legend-item--${s.key} inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium text-text-muted`}>{s.label}</span>
      ))}
    </div>
  );

  // Loading state — skeleton bars + spinner, respects reduced-motion via CSS.
  if (loading) {
    return (
      <div className="srchart srchart--loading relative flex w-full items-end" style={{ height }} role="status" aria-live="polite">
        {legend}
        <div className="srchart__skeleton flex h-full w-full items-end justify-between gap-2 pt-6" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="srchart__skeleton-bar min-w-[6px] flex-1 rounded-t-sm"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
        <span className="srchart__sr-only sr-only">Loading chart data…</span>
      </div>
    );
  }

  // Empty state — reuse the canonical .ui-state--empty block.
  if (!data.length) {
    return (
      <div className="srchart srchart--empty relative flex w-full items-center justify-center" style={{ height }}>
        <div className="ui-state ui-state--empty flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="ui-state__icon inline-flex h-12 w-12 items-center justify-center rounded-pill bg-grey-100 text-text-subtle" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="20" x2="6" y2="14" />
              <line x1="12" y1="20" x2="12" y2="9" />
              <line x1="18" y1="20" x2="18" y2="4" />
            </svg>
          </div>
          <p className="ui-state__title text-[length:var(--text-md)] font-semibold text-text">No data yet</p>
          <p className="ui-state__desc max-w-[360px] text-base leading-normal text-text-muted">Sales and revenue will appear here once orders are recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="srchart relative w-full" ref={wrapRef}>
      {legend}
      <svg
        className="srchart__svg block w-full overflow-visible"
        viewBox={`0 0 ${cfg.width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Sales and revenue by period"
      >
        {/* Horizontal grid and y-axis labels */}
        {cfg.yTicksVals.map((t, i) => {
          const yPos = cfg.y(t);
          return (
            <g key={`g-${i}`}>
              <line
                className="srchart__grid-line stroke-[var(--color-border)] [stroke-width:1]"
                x1={cfg.margin.left}
                x2={cfg.margin.left + cfg.innerW}
                y1={yPos}
                y2={yPos}
                strokeDasharray="4 4"
              />
              <text className="srchart__axis-label fill-[var(--color-text-subtle)] text-xs font-medium" x={cfg.margin.left + 2} y={yPos - 4} textAnchor="start">
                {cfg.formatK(t)}
              </text>
            </g>
          );
        })}

        {/* Bars — one group per active series */}
        {cfg.series.map((s, sIdx) => data.map((d, i) => {
          const val = d[s.key] || 0;
          const top = cfg.y(val);
          const h = cfg.margin.top + cfg.innerH - top;
          if (h <= 0) return null;
          return (
            <rect
              key={`${s.key}-${i}`}
              className={`srchart__bar srchart__bar--${s.key} ${s.cls} [transition:opacity_var(--transition-fast)]`}
              x={cfg.xOf(i, sIdx)}
              y={top}
              width={cfg.barW}
              height={h}
              rx="3"
            >
              <title>{`${d.label} — ${s.label}: ${val}`}</title>
            </rect>
          );
        }))}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={`l-${i}`}
            className="srchart__axis-label fill-[var(--color-text-subtle)] text-xs font-medium"
            x={cfg.margin.left + cfg.band * i + cfg.band / 2}
            y={height - 6}
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
