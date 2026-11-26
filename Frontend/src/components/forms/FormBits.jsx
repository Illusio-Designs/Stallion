'use client';
import React from 'react';

// Small pieces shared by the add/edit form panels. Styles: styles/redesign-p-forms.css

// A thin bar under the panel title: how many of the required fields are filled.
export const FormProgress = ({ label, done, total }) => {
  const pct = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;
  return (
    <div className="rf-prog">
      <div className="rf-prog__row">
        <span>{label}</span>
        <span>* required</span>
      </div>
      <div className="rf-prog__bar" role="progressbar" aria-label={`${label}: ${done} of ${total} required fields filled`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// A form section: short heading, optional help line, then the fields in a grid.
export const FormSec = ({ title, hint, children, className = '' }) => (
  <section className={`rf-sec ${className}`.trim()}>
    <div>
      <h3 className="rf-sec__h">{title}</h3>
      {hint ? <p className="rf-sec__d">{hint}</p> : null}
    </div>
    <div className="rf-grid">{children}</div>
  </section>
);

// All choices visible as chips. Same look as the offer and expense chips.
export const ChipRow = ({ label, options, value, onChange, disabled = false }) => (
  <div className="rf-chips" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        disabled={disabled}
        className={`rf-chip${value === o.value ? ' is-on' : ''}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);
