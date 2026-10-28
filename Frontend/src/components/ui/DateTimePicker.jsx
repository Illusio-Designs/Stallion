'use client';
import React from 'react';
import DatePicker from './DatePicker';
import DropdownSelector from './DropdownSelector';

const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: pad(i), label: pad(i) }));
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ value: pad(i), label: pad(i) }));

/**
 * Our own date + time picker, replacing <input type="datetime-local">.
 * value/onChange use 'YYYY-MM-DDTHH:mm' strings, the same as the native input.
 */
export default function DateTimePicker({ value, onChange, min, disabled = false, placeholder = 'Select date' }) {
  const [date = '', time = ''] = String(value || '').split('T');
  const [hh = '00', mm = '00'] = time.split(':');
  const emit = (d, h, m) => onChange?.(d ? `${d}T${h}:${m}` : '');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px 72px', gap: 8, alignItems: 'center' }}>
      <DatePicker value={date} min={min ? String(min).slice(0, 10) : undefined} disabled={disabled} placeholder={placeholder}
        onChange={(d) => emit(d, hh || '00', mm || '00')} />
      <DropdownSelector options={HOURS} value={hh} onChange={(h) => emit(date, h, mm)} disabled={disabled} />
      <DropdownSelector options={MINUTES} value={mm} onChange={(m) => emit(date, hh, m)} disabled={disabled} />
    </div>
  );
}
