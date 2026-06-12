'use client';
import React from 'react';
import '../../styles/components/skeleton.css';

/**
 * A single shimmer placeholder block.
 * @param {string|number} width  - CSS width (e.g. '100%', 120)
 * @param {string|number} height - CSS height
 * @param {number} radius        - border radius in px
 */
export function Skeleton({ width = '100%', height = 16, radius = 6, style = {}, className = '' }) {
  return (
    <span
      className={`ui-skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/**
 * Skeleton <tr> rows for use inside a table <tbody> while data loads.
 * Renders `rows` rows each with `cols` shimmer cells.
 */
export function SkeletonRows({ rows = 8, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={`sk-${r}`} className="ui-skeleton-row">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={`sk-${r}-${c}`} style={{ padding: '16px 8px' }}>
              <Skeleton height={14} width={c === 0 ? '50%' : '75%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default Skeleton;
