'use client';
import React from 'react';
import '../../styles/components/ui.css';

// Shape + colour come entirely from the unlayered `.ui-badge` / `.ui-badge--*`
// rules in ui.css. We deliberately do NOT add Tailwind utilities here: those
// live in @layer utilities and always lose to the unlayered .ui-badge, so
// duplicating them just creates dead, overlapping declarations. Single source
// of truth = ui.css.
const BASE = 'ui-badge';

const WARNING = `${BASE} ui-badge--warning`;
const INFO = `${BASE} ui-badge--info`;
const SUCCESS = `${BASE} ui-badge--success`;
const DANGER = `${BASE} ui-badge--danger`;

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
  default: BASE,
};

export default function StatusBadge({ status, children, className = '' }) {
  const key = String(status || '').toLowerCase();
  const classes = `${MAP[key] || MAP.default} ${className}`.trim();
  return <span className={classes}>{children || status}</span>;
}


