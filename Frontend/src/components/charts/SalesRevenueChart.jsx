'use client';
import React, { useMemo } from 'react';
import '../../styles/pages/dashboard-analytics.css';

// Lightweight SVG dual-bar chart (Sales = indigo, Revenue = amber) with grid,
// axis, legend, and loading / empty states. Colors are token-driven via CSS
// classes (see dashboard-analytics.css) so the chart stays on-brand.
export default function SalesRevenueChart({
  data = [], // [{label, sales, revenue}]
  height = 260,
  loading = false,
}) {
  const cfg = useMemo(() => {
    const margin = { top: 16, right: 0, bottom: 28, left: 0 };
    const width = 820; // scales via viewBox
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.sales || 0, d.revenue || 0)));
    const visualMax = maxVal * 1.5; // headroom like mock

    const n = Math.max(1, data.length);
    const band = innerW / n;
    // Thin bars with near-joined spacing like the mock
    const gap = Math.max(1, Math.min(4, band * 0.08));
    const barW = Math.max(6, Math.min(12, (band - gap) / 2));

    const centerX = (i) => margin.left + band * i + band / 2;
    const xRevenue = (i) => centerX(i) - gap / 2 - barW; // left (amber)
    const xSales = (i) => centerX(i) + gap / 2;          // right (indigo)
    const y = (v) => margin.top + innerH - (v / visualMax) * innerH;

    // y ticks at 0, 0.5, 1.0, 1.5 of max
    const yTicksVals = [0, 0.5, 1.0, 1.5].map(m => m * maxVal);
    const formatK = (v) => `$${(v / 1000).toFixed(1)}k`;

    return { margin, width, height, innerW, innerH, visualMax, band, barW, gap, xSales, xRevenue, y, yTicksVals, formatK };
  }, [data, height]);

  const legend = (
    <div className="srchart__legend" aria-hidden="true">
      <span className="srchart__legend-item srchart__legend-item--sales">Sales</span>
      <span className="srchart__legend-item srchart__legend-item--revenue">Revenue</span>
    </div>
  );

  // Loading state — skeleton bars + spinner, respects reduced-motion via CSS.
  if (loading) {
    return (
      <div className="srchart srchart--loading" style={{ height }} role="status" aria-live="polite">
        {legend}
        <div className="srchart__skeleton" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="srchart__skeleton-bar"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
        <span className="srchart__sr-only">Loading chart data…</span>
      </div>
    );
  }

  // Empty state — reuse the canonical .ui-state--empty block.
  if (!data.length) {
    return (
      <div className="srchart srchart--empty" style={{ height }}>
        <div className="ui-state ui-state--empty">
          <div className="ui-state__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="20" x2="6" y2="14" />
              <line x1="12" y1="20" x2="12" y2="9" />
              <line x1="18" y1="20" x2="18" y2="4" />
            </svg>
          </div>
          <p className="ui-state__title">No data yet</p>
          <p className="ui-state__desc">Sales and revenue will appear here once orders are recorded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="srchart">
      {legend}
      <svg
        className="srchart__svg"
        viewBox={`0 0 ${cfg.width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Sales and revenue by period"
      >
        {/* Horizontal grid and y-axis labels */}
        {cfg.yTicksVals.map((t, i) => {
          const yPos = cfg.y(t);
          return (
            <g key={`g-${i}`}>
              <line
                className="srchart__grid-line"
                x1={cfg.margin.left}
                x2={cfg.margin.left + cfg.innerW}
                y1={yPos}
                y2={yPos}
                strokeDasharray="4 4"
              />
              <text className="srchart__axis-label" x={cfg.margin.left + 2} y={yPos - 4} textAnchor="start">
                {cfg.formatK(t)}
              </text>
            </g>
          );
        })}

        {/* Bars: revenue (amber) then sales (indigo) */}
        {data.map((d, i) => (
          <rect
            key={`rev-${i}`}
            className="srchart__bar srchart__bar--revenue"
            x={cfg.xRevenue(i)}
            y={cfg.y(d.revenue || 0)}
            width={cfg.barW}
            height={cfg.margin.top + cfg.innerH - cfg.y(d.revenue || 0)}
            rx="3"
          >
            <title>{`${d.label} — Revenue: ${d.revenue ?? 0}`}</title>
          </rect>
        ))}
        {data.map((d, i) => (
          <rect
            key={`sal-${i}`}
            className="srchart__bar srchart__bar--sales"
            x={cfg.xSales(i)}
            y={cfg.y(d.sales || 0)}
            width={cfg.barW}
            height={cfg.margin.top + cfg.innerH - cfg.y(d.sales || 0)}
            rx="3"
          >
            <title>{`${d.label} — Sales: ${d.sales ?? 0}`}</title>
          </rect>
        ))}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={`l-${i}`}
            className="srchart__axis-label"
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
