'use client';
import React, { useId } from 'react';
import '../../styles/components/ui.css';

/**
 * Shared Active/Inactive status toggle for forms & modals — a branded checkbox
 * (.ui-checkbox) with a label that reads "Active" when on and "Inactive" when
 * off. Keeps every add/edit panel's status control consistent.
 *
 * Props:
 *  - checked: boolean
 *  - onChange: (checked: boolean) => void
 *  - label: optional fixed label (defaults to Active/Inactive based on state)
 *  - disabled, className
 */
export default function ActiveToggle({ checked, onChange, label, disabled = false, className = '' }) {
  const id = useId();
  const text = label || (checked ? 'Active' : 'Inactive');
  return (
    <div className={`form-group flex flex-row items-center gap-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="ui-checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
      />
      <label htmlFor={id} className="ui-label !mb-0 cursor-pointer">{text}</label>
    </div>
  );
}
