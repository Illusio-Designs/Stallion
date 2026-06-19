'use client';
import React from 'react';
import '../../styles/components/ui.css';

const BASE =
  'ui-badge inline-flex items-center gap-1 py-[2px] px-2 min-h-[22px] text-[length:var(--text-xs)] leading-[1.4] rounded-pill font-semibold whitespace-nowrap';

const WARNING = `${BASE} ui-badge--warning bg-warning-soft text-warning`;
const INFO = `${BASE} ui-badge--info bg-primary-soft text-primary`;
const SUCCESS = `${BASE} ui-badge--success bg-success-soft text-success`;
const DANGER = `${BASE} ui-badge--danger bg-error-soft text-error`;

const MAP = {
  pending: WARNING,
  processing: INFO,
  'hold-by-trey': WARNING,
  'partially-dispatch': INFO,
  'partially-dispatched': INFO,
  dispatch: INFO,
  dispatched: INFO,
  processed: SUCCESS,
  completed: SUCCESS,
  delivered: SUCCESS,
  cancelled: DANGER,
  rejected: DANGER,
  default: `${BASE} bg-grey-100 text-grey-700`,
};

export default function StatusBadge({ status, children, className = '' }) {
  const key = String(status || '').toLowerCase();
  const classes = `${MAP[key] || MAP.default} ${className}`.trim();
  return <span className={classes}>{children || status}</span>;
}


