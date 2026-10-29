'use client';
import React from 'react';
import '../../styles/redesign-p-retail.css';
import '../../styles/dark-retail.css';

/**
 * Wholesale / Retail segmented switch. The header shows it only for a person who may open both sides.
 * The caller remembers the choice and opens that side's home page.
 */
export default function SideSwitch({ side, onChange, className = '' }) {
  const items = [
    { id: 'wholesale', label: 'Wholesale' },
    { id: 'retail', label: 'Retail' },
  ];
  return (
    <div className={`rt-switch ${className}`.trim()} role="group" aria-label="Switch between Wholesale and Retail">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={`rt-switch__btn${side === it.id ? ' is-on' : ''}`}
          aria-pressed={side === it.id}
          onClick={() => { if (side !== it.id) onChange(it.id); }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
