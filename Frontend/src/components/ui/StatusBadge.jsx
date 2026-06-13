'use client';
import React from 'react';
import '../../styles/components/ui.css';

const BASE =
  'ui-badge inline-flex items-center gap-1 py-[2px] px-2 min-h-[22px] text-[length:var(--text-xs)] leading-[1.4] rounded-pill font-semibold whitespace-nowrap';

const MAP = {
  pending: `${BASE} ui-badge--warning bg-warning-soft text-warning`,
  processing: `${BASE} ui-badge--info bg-primary-soft text-primary`,
  completed: `${BASE} ui-badge--success bg-success-soft text-success`,
  cancelled: `${BASE} ui-badge--danger bg-error-soft text-error`,
  default: `${BASE} bg-grey-100 text-grey-700`,
};

export default function StatusBadge({ status, children, className = '' }) {
  const key = String(status || '').toLowerCase();
  const classes = `${MAP[key] || MAP.default} ${className}`.trim();
  return <span className={classes}>{children || status}</span>;
}


