'use client';
import React, { useEffect } from 'react';
import '../../styles/components/ui.css';

export default function Modal({ open, title, children, onClose, footer = null, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const sizeClass = size === 'sm' ? 'max-w-[420px]' : size === 'lg' ? 'max-w-[960px]' : 'max-w-[640px]';

  return (
    <div
      className="ui-modal__backdrop fixed inset-0 flex items-center justify-center p-4 z-50 bg-[rgba(26,27,35,0.45)] backdrop-blur-[3px]"
      aria-modal="true"
      role="dialog"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={onClose}
    >
      <div
        className={`ui-modal ui-modal--${size} ui-modal--enter w-full ${sizeClass} max-h-[90vh] flex flex-col overflow-hidden bg-surface rounded-xl shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__header flex items-center justify-between gap-4 px-6 py-5 border-b border-border">
          <h4 className="ui-modal__title m-0 text-[length:var(--text-lg)] font-semibold text-text tracking-[-0.01em]">{title}</h4>
          <button
            className="ui-modal__close inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-md border border-transparent bg-transparent text-text-muted text-[20px] leading-none cursor-pointer transition duration-200 ease-[ease] hover:bg-grey-100 hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            onClick={onClose}
            aria-label="Close"
          >×</button>
        </div>
        <div className="ui-modal__body flex-1 min-h-0 p-6 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">{children}</div>
        {footer && <div className="ui-modal__footer flex justify-end gap-3 px-6 py-4 border-t border-border">{footer}</div>}
      </div>
    </div>
  );
}


