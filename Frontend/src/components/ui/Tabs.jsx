'use client';
import React from 'react';
import '../../styles/components/ui.css';

export default function Tabs({ tabs = [], active, onChange, className = '' }) {
  return (
    <div
      className={`ui-tabs flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={active === t.value}
          className={`ui-tab relative whitespace-nowrap cursor-pointer p-3 border-none bg-transparent rounded-none text-[length:var(--text-base)] transition-colors duration-200 ease-[ease] hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] focus-visible:rounded-sm ${
            active === t.value
              ? 'ui-tab--active text-primary font-semibold'
              : 'text-text-muted font-medium'
          }`}
          onClick={() => onChange?.(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}


