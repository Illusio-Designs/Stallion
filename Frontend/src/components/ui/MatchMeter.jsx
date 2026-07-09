'use client';
import React from 'react';

/**
 * MatchMeter — shows how well a recorded visit/order GPS matches the party's
 * geocoded address, as a percentage with a colour-graded fill bar.
 *
 * 100% = recorded exactly on the party; the score falls linearly to 0% at
 * `max` metres away (default: twice the geofence radius). A distance within
 * `radius` (the geofence) is a verified on-site match.
 *
 * The fill colour is driven by the percentage ("based on filling"):
 *   >= 70%  green (strong match)
 *   40-69%  amber (borderline)
 *   <  40%  red   (off location)
 *
 * Props:
 *   distance  metres between the recorded GPS and the party address (null -> "—")
 *   radius    geofence radius in metres (default 250)
 *   max       distance at which the meter reads 0% (default radius * 2)
 *   href      optional Google-Maps link for the recorded point ("map")
 */
export default function MatchMeter({ distance, radius = 250, max, href }) {
  if (distance == null || Number.isNaN(Number(distance))) {
    return <span className="text-text-subtle">—</span>;
  }
  const d = Math.max(0, Number(distance));
  const span = max || radius * 2;
  const pct = Math.max(0, Math.min(100, Math.round(100 * (1 - d / span))));
  const color = pct >= 70 ? 'var(--color-success)'
    : pct >= 40 ? 'var(--color-warning)'
    : 'var(--color-error)';
  const matched = d <= radius;

  return (
    <span className="inline-flex items-center gap-2 min-w-[160px]" title={`${matched ? 'Within' : 'Outside'} ${radius}m geofence · ${Math.round(d)}m from party`}>
      <span className="relative h-[7px] flex-1 min-w-[64px] overflow-hidden rounded-[999px] bg-[var(--color-grey-200)]">
        <span
          className="absolute inset-y-0 left-0 rounded-[999px] transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="tabular-nums text-[var(--text-xs)] font-semibold" style={{ color }}>{pct}%</span>
      <span className="whitespace-nowrap text-[var(--text-xs)] text-text-subtle">
        {matched ? `${Math.round(d)}m` : `off ${Math.round(d)}m`}
      </span>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--text-xs)] font-medium text-primary">map</a>
      )}
    </span>
  );
}
