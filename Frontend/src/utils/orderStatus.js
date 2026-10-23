// One place for how an order status is written, coloured and counted.
// Stored values (order_status) match Backendjs/lib/constants/enums.js.
// Screen wording: PENDING, PROCESSING, PARTIALLY DISPATCH, DISPATCH, COMPLETED, CANCEL.
// 'HOLD BY SAMPLE' (hold_by_tray) exists only for old orders; pieces held in
// sample trays are shown as "N held by sample tray" next to the status.

export const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed',
  PARTIALLY_DISPATCHED: 'partially_dispatched',
  DISPATCHED: 'dispatched',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  HOLD_BY_TRAY: 'hold_by_tray',
};

// stored -> screen label (capitals, as shown in tables and pills)
export const ORDER_STATUS_LABEL = {
  pending: 'PENDING',
  processed: 'PROCESSING',
  hold_by_tray: 'HOLD BY SAMPLE',
  partially_dispatched: 'PARTIALLY DISPATCH',
  dispatched: 'DISPATCH',
  completed: 'COMPLETED',
  cancelled: 'CANCEL',
};

// stored -> sentence-case title (section headings, chips)
export const ORDER_STATUS_TITLE = {
  pending: 'Pending',
  processed: 'Processing',
  hold_by_tray: 'Hold by sample',
  partially_dispatched: 'Partially dispatch',
  dispatched: 'Dispatch',
  completed: 'Completed',
  cancelled: 'Cancel',
};

// screen label -> stored (edit modal)
export const ORDER_LABEL_TO_STATUS = Object.fromEntries(
  Object.entries(ORDER_STATUS_LABEL).map(([stored, label]) => [label, stored]),
);

// filter chip text -> stored. 'Hold by Sample' is only for old orders.
export const ORDER_TAB_TO_STATUS = {
  Pending: 'pending',
  Processing: 'processed',
  'Hold by Sample': 'hold_by_tray',
  'Partially Dispatch': 'partially_dispatched',
  Dispatch: 'dispatched',
  Completed: 'completed',
  Cancel: 'cancelled',
};
// Chips for the current flow (no legacy hold chip)
export const ORDER_FILTER_TABS = ['Pending', 'Processing', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'];
// Chips including the legacy one (office Orders page)
export const ORDER_FILTER_TABS_WITH_LEGACY = ['Pending', 'Processing', 'Hold by Sample', 'Partially Dispatch', 'Dispatch', 'Completed', 'Cancel'];

const norm = (s) => String(s || '').toLowerCase().trim();

// stored status -> screen label. Unknown values fall back to upper-case text.
export const orderStatusLabel = (stored) => {
  const key = norm(stored);
  return ORDER_STATUS_LABEL[key] || (key ? key.replace(/_/g, ' ').toUpperCase() : 'PENDING');
};

export const orderStatusTitle = (stored) => {
  const key = norm(stored);
  return ORDER_STATUS_TITLE[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ') : 'Pending');
};

// stored status -> pill tone: warn | dark | info | ok | bad
export const ORDER_STATUS_TONE = {
  pending: 'warn',
  processed: 'dark',
  hold_by_tray: 'warn',
  partially_dispatched: 'info',
  dispatched: 'ok',
  completed: 'ok',
  cancelled: 'bad',
};
export const orderStatusTone = (stored) => ORDER_STATUS_TONE[norm(stored)] || 'warn';

// Key understood by components/ui/StatusBadge for each tone.
const TONE_TO_BADGE = { warn: 'pending', dark: 'processing', info: 'partially-dispatch', ok: 'completed', bad: 'cancelled' };
export const orderStatusBadgeKey = (stored) => TONE_TO_BADGE[orderStatusTone(stored)];

// Same mapping as Backendjs OrderStatusTransitions.
export const ORDER_NEXT_STEPS = {
  pending: ['processed', 'cancelled'],
  processed: ['hold_by_tray', 'dispatched', 'partially_dispatched', 'cancelled'],
  hold_by_tray: ['dispatched', 'partially_dispatched', 'cancelled'],
  dispatched: ['completed', 'cancelled'],
  partially_dispatched: ['dispatched', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export const orderNextSteps = (stored) => ORDER_NEXT_STEPS[norm(stored)] || [];
export const canMoveOrder = (from, to) => orderNextSteps(from).includes(norm(to));

export const TASK_PILL = { booked: 'Booked', in_transit: 'In transit', received: 'Received' };

export const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${fmtDate(v)}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

// Tray tasks of an order, without the cancelled ones.
export const getTrayTasksOf = (order) => (Array.isArray(order?.tasks) ? order.tasks : []).filter((t) => t && t.status !== 'cancelled');

// Piece counts for an order. The server sends total/tray/held/shipped/ready;
// older orders without them are derived from the items and the status.
export const getPieceCounts = (order) => {
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const itemsTotal = items.reduce((sum, it) => sum + toInt(it?.quantity), 0);
  const total = toInt(order?.total_qty) || itemsTotal;
  const status = norm(order?.order_status);
  const shipments = Array.isArray(order?.shipments) ? order.shipments : [];
  let shipped = order?.shipped_qty != null ? toInt(order.shipped_qty) : shipments.reduce((sum, sh) => sum + toInt(sh?.qty), 0);
  if (order?.shipped_qty == null && !shipments.length && (status === 'dispatched' || status === 'completed')) shipped = total;
  const held = order?.held_qty != null ? toInt(order.held_qty) : 0;
  const ready = order?.ready_qty != null
    ? toInt(order.ready_qty)
    : (status === 'processed' || status === 'partially_dispatched' ? Math.max(total - shipped - held, 0) : 0);
  const cancelled = status === 'cancelled' ? Math.max(total - shipped, 0) : 0;
  const tasks = getTrayTasksOf(order);
  const taskSum = (state) => tasks.filter((t) => t.status === state).reduce((sum, t) => sum + toInt(t.qty), 0);
  const inTransit = order?.in_transit_qty != null ? toInt(order.in_transit_qty) : taskSum('in_transit');
  const receivedTray = order?.received_tray_qty != null ? toInt(order.received_tray_qty) : taskSum('received');
  const gone = status === 'cancelled';
  return {
    total,
    shipped,
    ready: gone ? 0 : ready,
    held: gone ? 0 : held,
    inTransit: gone ? 0 : Math.min(inTransit, held),
    receivedTray,
    cancelled,
    trayQty: toInt(order?.tray_qty),
  };
};

// { total, sent, ready, held, inTransit } with safe fallbacks for old orders.
export const pieceSummary = (order) => {
  const c = getPieceCounts(order);
  return { total: c.total, sent: c.shipped, ready: c.ready, held: c.held, inTransit: c.inTransit };
};

// "80 of 100 sent, 20 held by sample tray" (empty when the order has no pieces)
export const pieceSummaryLine = (order) => {
  const { total, sent, held } = pieceSummary(order);
  if (!total) return '';
  const parts = [`${sent} of ${total} sent`];
  if (held > 0) parts.push(`${held} held by sample tray`);
  return parts.join(', ');
};

export const heldNote = (order) => {
  const { held } = pieceSummary(order);
  return held > 0 ? `${held} held by sample tray` : '';
};

// Shipments of an order; old orders with only courier fields give one entry.
export const getShipments = (order) => {
  const list = Array.isArray(order?.shipments) ? order.shipments : [];
  if (list.length) return list;
  if (order?.courier_name || order?.courier_tracking_number) {
    return [{
      shipment_id: 'legacy',
      courier_name: order.courier_name,
      tracking_number: order.courier_tracking_number,
      qty: null,
      shipped_at: order.dispatched_at || null,
    }];
  }
  return [];
};
