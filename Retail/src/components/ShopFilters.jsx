'use client';
import { useEffect, useState } from 'react';

// Wraps the (server rendered) filter links: a bottom sheet on phones and tablets, a plain side column on desktop.
export default function ShopFilters({ children, activeCount = 0, total = 0 }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button type="button" className="btn sh-fbtn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      <div className={`sh-scrim${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`sh-side${open ? ' is-open' : ''}`} aria-label="Filters" role={open ? 'dialog' : undefined} aria-modal={open ? 'true' : undefined}>
        <div className="sh-side__hd">
          <b>Filters</b>
          <button type="button" className="ib" aria-label="Close filters" onClick={() => setOpen(false)}>&#10005;</button>
        </div>
        <div className="sh-side__body">{children}</div>
        <div className="sh-side__ft">
          <button type="button" className="btn btn--pri" onClick={() => setOpen(false)}>Show {total} {total === 1 ? 'frame' : 'frames'}</button>
        </div>
      </aside>
    </>
  );
}
