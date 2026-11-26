'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const backdropRef = useRef(null);
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

  // On phones and tablets the on-screen keyboard covers the lower part of the page. Keep the panel inside
  // the part that is still visible, so the footer (Save) sits right above the keyboard and the form
  // scrolls. The field being typed in is scrolled into view.
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !window.visualViewport) return undefined;
    const vv = window.visualViewport;
    const el = () => backdropRef.current;
    const fit = () => {
      const node = el();
      if (!node) return;
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      if (covered > 80) {
        node.style.top = `${vv.offsetTop}px`;
        node.style.height = `${vv.height}px`;
        node.style.bottom = 'auto';
      } else {
        node.style.top = '';
        node.style.height = '';
        node.style.bottom = '';
      }
    };
    const onFocusIn = (e) => {
      const t = e.target;
      if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      setTimeout(() => { fit(); t.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, 250);
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    document.addEventListener('focusin', onFocusIn);
    fit();
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [mounted]);

  // Restore focus to whatever opened the panel once it is fully gone.
  useEffect(() => {
    if (mounted) return;
    lastFocused.current?.focus?.();
    lastFocused.current = null;
  }, [mounted]);

  // Many forms put a <label> next to its field without linking them. Link each pair so a
  // screen reader reads the label when the field gets focus.
  useEffect(() => {
    if (!mounted) return undefined;
    const t = setTimeout(() => {
      document.querySelectorAll('.ui-aside-panel__backdrop .form-group').forEach((g, gi) => {
        const label = g.querySelector('label');
        const field = g.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
        if (!label || !field || label.htmlFor || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby')) return;
        if (!field.id) field.id = `fld-${gi}-${Math.random().toString(36).slice(2, 7)}`;
        label.htmlFor = field.id;
      });
    }, 50);
    return () => clearTimeout(t);
  }, [mounted, children]);

  if (!mounted || typeof document === 'undefined') return null;

  // Portal to <body> so the fixed overlay covers the whole viewport (above the
  // dashboard header/footer). Rendering in-place gets trapped by ancestor
  // transforms (e.g. .page-enter on the dashboard content), which clips it.
  return createPortal(
    <div
      ref={backdropRef}
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
          <h2 className="ui-aside-panel__title">{title}</h2>
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
    </div>,
    document.body
  );
}
