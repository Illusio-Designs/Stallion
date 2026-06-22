'use client';
import React, { useEffect, useRef, useState } from 'react';
import '../../styles/components/ui.css';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Offer/coupon picker shown as a dropdown: the trigger shows the applied coupon
 * (or a prompt), and opening it reveals the coupon cards. Exactly one offer
 * applies at a time — Apply selects it and closes; "No offer" clears it. The
 * card list scrolls when there are many coupons.
 *
 * Props:
 *  - offers: [{ offer_id, title, offer_type, discount_amount }]
 *  - selectedId: string (applied offer_id, or '')
 *  - onSelect: (offerId | '') => void
 */
export default function OfferCoupons({ offers = [], selectedId = '', onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!offers.length) return null;

  const selected = offers.find((o) => o.offer_id === selectedId);
  const choose = (id) => { onSelect && onSelect(id); setOpen(false); };

  return (
    <div ref={ref} className={`ui-dropdown-custom ui-dropdown-custom--full-width ${open ? 'ui-dropdown-custom--open' : ''}`}>
      <div className="ui-dropdown-custom__trigger" role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
      >
        <span className={`ui-dropdown-custom__value ${!selected ? 'ui-dropdown-custom__value--placeholder' : ''}`}>
          {selected ? `${selected.title} — ${inr(selected.discount_amount)} off` : `Apply a coupon (${offers.length} available)`}
        </span>
        <svg className="ui-dropdown-custom__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      {open && (
        <div className="ui-dropdown-custom__menu p-2.5">
          <button
            type="button"
            onClick={() => choose('')}
            className={`mb-2 w-full rounded-md px-3 py-2 text-left text-[length:var(--text-sm)] font-medium transition ${!selected ? 'bg-primary-soft text-primary' : 'text-text-muted hover:bg-grey-100'}`}
          >
            No offer
          </button>
          <div className={`flex flex-col gap-2.5 ${offers.length > 3 ? 'max-h-[300px] overflow-y-auto pr-1' : ''}`}>
            {offers.map((o) => {
              const applied = selectedId === o.offer_id;
              const save = Number(o.discount_amount || 0);
              return (
                <div
                  key={o.offer_id}
                  className={`relative flex overflow-hidden rounded-xl bg-surface transition ${applied ? 'border border-primary shadow-[0_0_0_1px_var(--color-primary)]' : 'border border-grey-100'}`}
                >
                  <div className="flex items-center justify-center bg-primary px-2.5 [writing-mode:vertical-rl] rotate-180">
                    <span className="text-text-on-primary text-[length:var(--text-xs)] font-bold uppercase tracking-wider [font-variant-numeric:tabular-nums]">
                      {inr(save)} OFF
                    </span>
                  </div>
                  <div className="flex-1 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-[length:var(--text-base)] font-bold text-text leading-[var(--leading-snug)] break-words">{o.title}</h4>
                      <button
                        type="button"
                        onClick={() => choose(applied ? '' : o.offer_id)}
                        className={`shrink-0 text-[length:var(--text-sm)] font-bold uppercase tracking-[var(--tracking-label)] ${applied ? 'text-success' : 'text-primary hover:text-primary-hover'}`}
                      >
                        {applied ? '✓ Applied' : 'Apply'}
                      </button>
                    </div>
                    <p className="mt-1 text-[length:var(--text-sm)] font-medium text-success [font-variant-numeric:tabular-nums]">
                      Save {inr(save)} on this order!
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
