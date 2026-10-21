'use client';
import React, { useMemo, useRef, useState, useEffect } from 'react';

// Black and white bar chart for the dashboard: grey bars, the current period in
// ink black, five grid lines with a value axis on the left. Pure SVG, no libraries.
// data: [{ label, value, current?, title? }]
const niceMax = (v) => {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v / 4)));
  const n = (v / 4) / step;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * step * 4;
};

export default function OrdersPerDayChart({ data = [], height = 215, ariaLabel }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(690);
  useEffect(() => {
    if (typeof window === 'undefined' || !wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => setW(Math.max(260, Math.round(el.clientWidth) || 690));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cfg = useMemo(() => {
    const left = 40, right = 10, top = 14, bottom = 26;
    const innerW = w - left - right;
    const innerH = height - top - bottom;
    const max = niceMax(Math.max(1, ...data.map((d) => d.value || 0)));
    const n = Math.max(1, data.length);
    const band = innerW / n;
    const barW = Math.max(4, Math.min(28, band * 0.62));
    const y = (v) => top + innerH - (v / max) * innerH;
    const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
    // Thin the x labels so they never touch.
    const every = Math.max(1, Math.ceil(30 / band));
    return { left, top, innerW, innerH, max, band, barW, y, ticks, every };
  }, [data, w, height]);

  const empty = !data.some((d) => d.value > 0);
  return (
    <div className="rda-chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img"
        aria-label={ariaLabel || 'Bar chart of orders'}>
        <g stroke="#e1e1e1" strokeWidth="1">
          {cfg.ticks.map((t, i) => (
            <line key={i} x1={cfg.left} x2={cfg.left + cfg.innerW} y1={cfg.y(t)} y2={cfg.y(t)} />
          ))}
        </g>
        <g textAnchor="end">
          {cfg.ticks.map((t, i) => (
            <text key={i} x={cfg.left - 10} y={cfg.y(t) + 4}>{Math.round(t * 10) / 10}</text>
          ))}
        </g>
        {data.map((d, i) => {
          const top = cfg.y(d.value || 0);
          const h = cfg.top + cfg.innerH - top;
          const x = cfg.left + cfg.band * i + (cfg.band - cfg.barW) / 2;
          return h > 0 ? (
            <rect key={i} x={x} y={top} width={cfg.barW} height={h} rx={Math.min(5, cfg.barW / 2)}
              fill={d.current ? '#0a0a0a' : '#c2c2c2'}>
              <title>{d.title || `${d.label}: ${d.value}`}</title>
            </rect>
          ) : null;
        })}
        <g textAnchor="middle">
          {data.map((d, i) => (data.length - 1 - i) % cfg.every === 0 && (
            <text key={i} x={cfg.left + cfg.band * i + cfg.band / 2} y={height - 6}>{d.label}</text>
          ))}
        </g>
      </svg>
      {empty && <p className="rda-chart__empty">No orders in this period yet.</p>}
    </div>
  );
}
