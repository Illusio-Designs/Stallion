'use client';
import React from 'react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Coupon-style list of the offers available for a cart. Exactly one offer
 * applies at a time — Apply selects it, tapping Applied clears it. The list
 * scrolls once there are more than a few coupons.
 *
 * Props:
 *  - offers: [{ offer_id, title, offer_type, discount_amount }]
 *  - selectedId: string (the applied offer_id, or '')
 *  - onSelect: (offerId | '') => void
 */
export default function OfferCoupons({ offers = [], selectedId = '', onSelect }) {
  if (!offers.length) return null;
  return (
    <div className={`flex flex-col gap-2.5 ${offers.length > 3 ? 'max-h-[330px] overflow-y-auto pr-1' : ''}`}>
      {offers.map((o) => {
        const applied = selectedId === o.offer_id;
        const save = Number(o.discount_amount || 0);
        return (
          <div
            key={o.offer_id}
            className={`relative flex overflow-hidden rounded-xl bg-surface transition ${applied ? 'border border-primary shadow-[0_0_0_1px_var(--color-primary),0_8px_20px_-12px_var(--color-primary)]' : 'border border-grey-100'}`}
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
                  onClick={() => onSelect && onSelect(applied ? '' : o.offer_id)}
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
  );
}
