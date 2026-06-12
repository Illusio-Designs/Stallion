'use client';
import React from 'react';
import '../../styles/components/ui.css';

export default function Tabs({ tabs = [], active, onChange, className = '' }) {
  return (
    <div className={`ui-tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={`ui-tab ${active === t.value ? 'ui-tab--active' : ''}`}
          onClick={() => onChange?.(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}


