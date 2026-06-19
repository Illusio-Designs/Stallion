'use client';
import { useEffect } from 'react';
import '../../styles/components/ui.css';

/**
 * Centered confirmation dialog (replaces native window.confirm).
 * Usually driven through the ConfirmProvider / useConfirm() hook rather than
 * rendered directly. Reuses the shared .ui-modal styles.
 */
export default function ConfirmDialog({
  open,
  title = 'Please confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="ui-modal__backdrop"
      // Above the aside panel (10050) so a confirm can open over a panel,
      // but below the toast layer (99998) so notifications still show.
      style={{ zIndex: 99990 }}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'Confirm'}
      onClick={onCancel}
    >
      <div className="ui-modal__scroll">
        <div className="ui-modal ui-modal--sm ui-modal--enter" onClick={(e) => e.stopPropagation()}>
          <div className="ui-modal__header">
            <h4 className="ui-modal__title">{title}</h4>
            <button className="ui-modal__close" onClick={onCancel} aria-label="Close" type="button">×</button>
          </div>
          <div className="ui-modal__body">
            {typeof message === 'string'
              ? <p className="m-0 text-[length:var(--text-base)] text-text-muted">{message}</p>
              : message}
          </div>
          <div className="ui-modal__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={danger
                ? 'ui-btn bg-[var(--color-error)] text-white hover:enabled:opacity-90'
                : 'ui-btn ui-btn--primary'}
              onClick={onConfirm}
              autoFocus
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
