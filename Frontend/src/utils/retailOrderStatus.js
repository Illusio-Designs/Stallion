// Online order statuses (see the contract): pending -> confirmed -> packed -> dispatched -> out_for_delivery -> delivered,
// and the side statuses cancelled and returned.
import { sentence } from './retailFormat';

export const RETAIL_STATUSES = ['pending', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];

export const statusLabel = (s) => sentence(s);

// StatusBadge already has the colours for the wholesale flow; map ours onto them.
const BADGE = {
  pending: 'pending',
  confirmed: 'processing',
  packed: 'processing',
  dispatched: 'dispatched',
  out_for_delivery: 'dispatched',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'rejected',
};
export const statusBadgeKey = (s) => BADGE[String(s || '').toLowerCase()] || 'default';

/** The status that normally comes next (the first the server allows), or null at the end of the flow. */
export const nextStatus = (s, allowed = null) => {
  const cur = String(s || '').toLowerCase();
  const i = RETAIL_STATUSES.indexOf(cur);
  const next = i >= 0 && i < 5 ? RETAIL_STATUSES[i + 1] : null;
  if (!Array.isArray(allowed)) return next;
  return allowed.includes(next) ? next : (allowed.find((x) => x !== 'cancelled' && x !== 'returned') || null);
};

/**
 * Statuses an order can be moved to. The server sends the allowed list (allowed_next) with every order;
 * without it every other status is offered and the server has the last word.
 */
export const statusChoices = (current, allowed = null) => (Array.isArray(allowed) ? RETAIL_STATUSES.filter((s) => allowed.includes(s)) : RETAIL_STATUSES)
  .filter((s) => s !== String(current || '').toLowerCase())
  .map((s) => ({ value: s, label: statusLabel(s) }));
