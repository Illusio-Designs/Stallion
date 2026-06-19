'use client';
import { useEffect, useRef, useState } from 'react';
import '../../styles/components/ui.css';

// Keep in sync with the panel's transition duration in ui.css (.ui-aside-panel).
const EXIT_MS = 280;

/**
 * Right-side slide-over panel (drawer). Drop-in replacement for the old Modal.
 *
 * Props: open, title, children, onClose, footer, width ('sm' | 'md' | 'lg').
 *
 * Handles enter AND exit animation (slides off-screen before unmounting),
 * Escape-to-close, backdrop-click-to-close, body scroll lock, and focus
 * management (focuses the panel on open, restores the trigger on close).
 */
export default function AsidePanel({
  open,
  title,
  children,
  onClose,
  footer = null,
  width = 'md',
}) {
  // `mounted` keeps the panel in the DOM through the exit animation;
  // `entered` toggles the .is-open class that drives the slide/fade.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef(null);
  const lastFocused = useRef(null);

  // Drive mount + enter/exit transitions off the `open` prop.
  useEffect(() => {
    if (open) {
      if (typeof document !== 'undefined') {
        lastFocused.current = document.activeElement;
      }
      setMounted(true);
      // Two frames so the browser paints the off-screen state before we
      // flip to .is-open, otherwise the slide-in is skipped.
      let raf2;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    // Closing: play the exit transition, then unmount.
    setEntered(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the latest onClose without making the effects below depend on its
  // identity (consumers pass an inline arrow, so it changes every render).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Focus the panel ONCE when it opens — not on every parent re-render.
  // (Re-focusing on each render stole focus from inputs after one keystroke.)
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  // While mounted: lock body scroll + wire Escape. Depends only on `mounted`
  // so typing in the parent never re-runs this (which would thrash focus/scroll).
  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mounted]);

  // Restore focus to whatever opened the panel once it is fully gone.
  useEffect(() => {
    if (mounted) return;
    lastFocused.current?.focus?.();
    lastFocused.current = null;
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`ui-aside-panel__backdrop${entered ? ' is-open' : ''}`}
      onClick={onClose}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`ui-aside-panel ui-aside-panel--${width}${entered ? ' is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-aside-panel__header">
          <h4 className="ui-aside-panel__title">{title}</h4>
          <button
            className="ui-aside-panel__close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>
        <div className="ui-aside-panel__body">{children}</div>
        {footer && <div className="ui-aside-panel__footer">{footer}</div>}
      </aside>
    </div>
  );
}
