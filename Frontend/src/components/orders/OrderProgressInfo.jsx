import React from 'react';
import { pieceSummaryLine, getPieceCounts, getShipments, fmtDate, fmtDateTime } from '../../utils/orderStatus';
import '../../styles/redesign-n-orders.css';

// Read-only order progress for distributors, parties and salesmen:
// stock bar, "80 of 100 sent, 20 held by sample tray", shipments, delivered
// date and cancel reason. No office actions live here.
export default function OrderProgressInfo({ order }) {
  if (!order) return null;
  const status = String(order.order_status || 'pending').toLowerCase();
  const counts = getPieceCounts(order);
  const shipments = getShipments(order);
  const line = pieceSummaryLine(order);
  const seg = (cls, n, label) => (n > 0 ? <div className={`ordn-seg ordn-seg--${cls}`} style={{ flex: `${n} 1 0` }} title={`${n} ${label}`}>{n}</div> : null);
  const rows = [];
  if (status === 'completed' && order.delivered_at) rows.push(['Delivered', fmtDateTime(order.delivered_at)]);
  if (status === 'completed' && order.received_by) rows.push(['Received by', order.received_by]);
  if (status === 'cancelled' || counts.cancelled > 0) {
    if (counts.cancelled > 0 && status !== 'cancelled') {
      rows.push(['Cancelled pieces', `Cancelled ${counts.cancelled} pieces${order.cancel_reason ? `: ${order.cancel_reason}` : ''}`]);
    } else if (order.cancel_reason) rows.push(['Cancel reason', order.cancel_reason]);
    if (order.cancelled_at) rows.push(['Cancelled', fmtDateTime(order.cancelled_at)]);
  }
  if (!line && !shipments.length && !rows.length) return null;
  return (
    <div className="ordn-progress">
      {line && (
        <div className="ordn-flow">
          <p className="font-semibold">{line}</p>
          <div className="ordn-bar" role="img" aria-label={line}>
            {seg('sent', counts.shipped, 'sent')}
            {seg('ready', counts.ready, 'ready to send')}
            {seg('transit', counts.inTransit, 'in transit to office')}
            {seg('held', counts.held - counts.inTransit, 'held by sample tray')}
            {seg('canc', counts.cancelled, 'cancelled')}
          </div>
        </div>
      )}
      {shipments.length > 0 && (
        <div>
          <h5 className="ord-view__section-title">Shipments</h5>
          <ul className="ordn-ship">
            {shipments.map((sh, n) => (
              <li key={sh.shipment_id || n}>
                <b>#{n + 1}{sh.qty != null ? ` · ${sh.qty} pcs` : ''}</b>
                <span>{[sh.courier_name, sh.tracking_number].filter(Boolean).join(' · ') || '—'}</span>
                {sh.shipped_at && <small>{fmtDate(sh.shipped_at)}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rows.length > 0 && (
        <dl className="ordn-fl">
          {rows.map(([k, v]) => <div className="ordn-fl__row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
