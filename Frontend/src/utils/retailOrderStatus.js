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

/** The status that normally comes next, or null at the end of the flow. */
export const nextStatus = (s) => {
  const i = RETAIL_STATUSES.indexOf(String(s || '').toLowerCase());
  return i >= 0 && i < 5 ? RETAIL_STATUSES[i + 1] : null;
};

/** Statuses an order can be moved to from its current one (every other status; the server has the last word). */
export const statusChoices = (current) => RETAIL_STATUSES
  .filter((s) => s !== String(current || '').toLowerCase())
  .map((s) => ({ value: s, label: statusLabel(s) }));
