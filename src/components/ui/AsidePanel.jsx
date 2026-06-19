'use client';
import { useEffect } from 'react';
import '../../styles/components/ui.css';

export default function AsidePanel({
  open,
  title,
  children,
  onClose,
  footer = null,
  width = 'md',
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ui-aside-panel__backdrop"
      aria-modal="true"
      role="dialog"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={onClose}
    >
      <aside
        className={`ui-aside-panel ui-aside-panel--${width} ui-aside-panel--enter`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-aside-panel__header">
          <h4 className="ui-aside-panel__title">{title}</h4>
          <button className="ui-aside-panel__close" onClick={onClose} aria-label="Close" type="button">×</button>
        </div>
        <div className="ui-aside-panel__body">{children}</div>
        {footer && <div className="ui-aside-panel__footer">{footer}</div>}
      </aside>
    </div>
  );
}
