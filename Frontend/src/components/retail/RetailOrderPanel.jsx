'use client';
import React, { useEffect, useState } from 'react';
import AsidePanel from '../ui/AsidePanel';
import DropdownSelector from '../ui/DropdownSelector';
import StatusBadge from '../ui/StatusBadge';
import { useConfirm } from '../ui/ConfirmProvider';
import { getRetailOrder, updateRetailOrderStatus, updateRetailOrderShipping, retailData } from '../../services/api/retailApi';
import { showSuccess, showError } from '../../services/notificationService';
import { errorText, Field, Thumb } from './RetailBits';
import { rupees, istDateTime, istDate, normalizeOrder } from '../../utils/retailFormat';
import { statusBadgeKey, statusLabel, statusChoices, nextStatus } from '../../utils/retailOrderStatus';
import '../../styles/redesign-p-retail.css';
import '../../styles/dark-retail.css';

const paymentLabel = (o) => {
  const type = String(o.payment_type || 'cod').toLowerCase() === 'cod' ? 'Cash on delivery' : 'Online payment';
  const st = o.payment_status ? ` · ${statusLabel(o.payment_status)}` : '';
  return `${type}${st}`;
};

/** Order detail: items, timeline, status change with a note, courier / AWB / tracking link. */
export default function RetailOrderPanel({ orderId, onClose, onChanged }) {
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [ship, setShip] = useState({ courier: '', awb: '', tracking_url: '' });
  const [shipErr, setShipErr] = useState('');
  const [savingShip, setSavingShip] = useState(false);

  const apply = (o) => {
    setOrder(o);
    setStatus(nextStatus(o.status) || '');
    setNote('');
    setShip({ courier: o.courier || '', awb: o.awb || '', tracking_url: o.tracking_url || '' });
  };

  const load = async (id) => {
    setLoading(true);
    setError('');
    try {
      apply(normalizeOrder(retailData(await getRetailOrder(id))));
    } catch (e) {
      setError(errorText(e, 'Could not load this order.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) { setOrder(null); setError(''); return; }
    setOrder(null);
    load(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const changeStatus = async () => {
    if (!status) { showError('Pick the new status first.'); return; }
    if (status === 'cancelled' || status === 'returned') {
      const ok = await confirm({
        title: status === 'cancelled' ? 'Cancel this order?' : 'Mark as returned?',
        message: status === 'cancelled' ? 'The frames go back into store stock. This cannot be undone from here.' : 'The customer is told the order was returned.',
        confirmLabel: status === 'cancelled' ? 'Cancel order' : 'Mark returned',
        danger: true,
      });
      if (!ok) return;
    }
    setSavingStatus(true);
    try {
      await updateRetailOrderStatus(order.id, { status, note: note.trim() });
      showSuccess('', null, 'Status updated', `${order.order_number} is now ${statusLabel(status).toLowerCase()}.`);
      await load(order.id);
      onChanged?.();
    } catch (e) {
      showError(errorText(e), null, 'Could not change the status');
    } finally {
      setSavingStatus(false);
    }
  };

  const saveShipping = async () => {
    const url = ship.tracking_url.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) { setShipErr('The tracking link must start with https://'); return; }
    if (!ship.courier.trim() && !ship.awb.trim() && !url) { setShipErr('Enter the courier, the AWB number or a tracking link.'); return; }
    setShipErr('');
    setSavingShip(true);
    try {
      await updateRetailOrderShipping(order.id, { courier: ship.courier.trim(), awb: ship.awb.trim(), tracking_url: url });
      showSuccess('Shipping details saved');
      await load(order.id);
      onChanged?.();
    } catch (e) {
      showError(errorText(e), null, 'Could not save the shipping details');
    } finally {
      setSavingShip(false);
    }
  };

  const o = order;
  const finished = o && ['delivered', 'cancelled', 'returned'].includes(o.status);

  return (
    <AsidePanel open={!!orderId} onClose={onClose} title={o ? `Order ${o.order_number}` : 'Order'} width="lg">
      {loading && !o ? <div className="rt-pad" aria-busy="true"><span className="ui-skeleton rt-block-skel" aria-hidden="true" /></div> : null}
      {error ? (
        <div className="rt-pad">
          <p className="rt-error" role="alert">{error}</p>
          <button type="button" className="ui-btn ui-btn--secondary" onClick={() => load(orderId)}>Try again</button>
        </div>
      ) : null}
      {o && (
        <div className="rt-order rf-form">
          <div className="rt-order__top">
            <StatusBadge status={statusBadgeKey(o.status)}>{statusLabel(o.status)}</StatusBadge>
            <span>{istDateTime(o.created_at)}</span>
            <span>{paymentLabel(o)}</span>
          </div>

          <section className="rt-order__sec">
            <h3>Customer</h3>
            <p><b>{o.customer_name}</b></p>
            <p>{o.customer_phone ? <a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a> : null}{o.customer_email ? <> · <a href={`mailto:${o.customer_email}`}>{o.customer_email}</a></> : null}</p>
            <p className="rt-mute">{o.address_text || 'No address'}</p>
            {o.notes ? <p className="rt-note">Customer note: {o.notes}</p> : null}
          </section>

          <section className="rt-order__sec">
            <h3>Items</h3>
            <ul className="rt-items">
              {o.items.map((i, idx) => (
                <li key={i.key ?? idx}>
                  <Thumb src={i.image} alt="" />
                  <span className="rt-items__t"><b>{i.title}</b><small>{i.model_no && i.model_no !== i.title ? `${i.model_no} · ` : ''}{rupees(i.price)} × {i.quantity}</small></span>
                  <b>{rupees(i.line_total)}</b>
                </li>
              ))}
              {o.items.length === 0 && <li className="rt-mute">No items listed.</li>}
            </ul>
            <dl className="rt-totals">
              <div><dt>Subtotal</dt><dd>{rupees(o.subtotal)}</dd></div>
              <div><dt>Shipping</dt><dd>{Number(o.shipping_fee) ? rupees(o.shipping_fee) : 'Free'}</dd></div>
              {Number(o.cod_fee) > 0 && <div><dt>Cash on delivery fee</dt><dd>{rupees(o.cod_fee)}</dd></div>}
              <div className="rt-totals__sum"><dt>Total</dt><dd>{rupees(o.total)}</dd></div>
            </dl>
            {o.expected_delivery ? <p className="rt-mute">Expected delivery: {istDate(o.expected_delivery)}</p> : null}
          </section>

          <section className="rt-order__sec">
            <h3>Timeline</h3>
            {o.timeline.length === 0 ? <p className="rt-mute">No changes yet.</p> : (
              <ol className="rt-timeline">
                {o.timeline.map((t) => (
                  <li key={t.key}>
                    <b>{statusLabel(t.status)}</b>
                    <small>{istDateTime(t.at)}</small>
                    {t.note ? <span>{t.note}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rt-order__sec">
            <h3>Change status</h3>
            {finished ? (
              <p className="rt-mute">This order is {statusLabel(o.status).toLowerCase()}. You can still correct the status if it was set by mistake.</p>
            ) : null}
            <div className="rf-grid">
              <Field label="New status">
                <DropdownSelector options={statusChoices(o.status)} value={status} onChange={setStatus} placeholder="Pick a status" searchable={false} className="rt-dd" />
              </Field>
              <Field label="Note for the timeline (optional)" full>
                <textarea className="ui-input rt-ta" rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="For example: packed in a hard case" />
              </Field>
            </div>
            <button type="button" className="ui-btn ui-btn--primary rt-wide" onClick={changeStatus} disabled={savingStatus || !status}>
              {savingStatus ? 'Saving...' : 'Update status'}
            </button>
          </section>

          <section className="rt-order__sec">
            <h3>Courier and tracking</h3>
            <div className="rf-grid">
              <Field label="Courier">
                <input className="ui-input" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} placeholder="For example: Delhivery" />
              </Field>
              <Field label="AWB number">
                <input className="ui-input" value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} placeholder="Tracking number" />
              </Field>
              <Field label="Tracking link" full hint="Customers open this from their order tracking page.">
                <input className="ui-input" type="url" inputMode="url" value={ship.tracking_url} onChange={(e) => { setShip({ ...ship, tracking_url: e.target.value }); setShipErr(''); }} placeholder="https://" />
              </Field>
            </div>
            {shipErr && <p className="rt-error" role="alert">{shipErr}</p>}
            <button type="button" className="ui-btn ui-btn--secondary rt-wide" onClick={saveShipping} disabled={savingShip}>
              {savingShip ? 'Saving...' : 'Save shipping details'}
            </button>
          </section>
        </div>
      )}
    </AsidePanel>
  );
}
