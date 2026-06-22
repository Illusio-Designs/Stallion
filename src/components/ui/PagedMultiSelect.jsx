'use client';
import React, { useState, useRef, useEffect } from 'react';
import '../../styles/components/ui.css';

/**
 * Multi-select dropdown for HEAVY lists: the options are fetched a page at a
 * time (default 20) with Previous / Next paging and a server search, all INSIDE
 * the dropdown menu. Selected items show as removable chips under the trigger.
 *
 * Props:
 *  - fetchPage(page, search) => Promise<array | { data: array }>
 *  - mapItem(item) => { value, label }
 *  - selected: [{ id, label }]
 *  - onToggle(opt), onRemove(id)
 *  - placeholder, searchPlaceholder, pageSize, className, disabled
 */
export default function PagedMultiSelect({
  fetchPage,
  mapItem,
  selected = [],
  onToggle,
  onRemove,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  pageSize = 20,
  className = '',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const debounceRef = useRef(null);

  const load = async (p, s) => {
    setLoading(true);
    try {
      const resp = await fetchPage(p, s);
      const arr = Array.isArray(resp) ? resp : (resp?.data || []);
      setList(arr.map(mapItem));
      setPage(p);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  // Load page 1 when opened, and (debounced) whenever the search changes.
  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, search]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    if (isOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen]);

  const selectedSet = new Set(selected.map((s) => String(s.id)));
  const triggerLabel = selected.length > 0 ? `${selected.length} selected` : placeholder;

  return (
    <div ref={ref} className={`ui-dropdown-custom ui-dropdown-custom--full-width ${isOpen ? 'ui-dropdown-custom--open' : ''} ${disabled ? 'ui-dropdown-custom--disabled' : ''} ${className}`}>
      <div
        className="ui-dropdown-custom__trigger"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setIsOpen((o) => !o); } }}
      >
        <span className={`ui-dropdown-custom__value ${selected.length === 0 ? 'ui-dropdown-custom__value--placeholder' : ''}`}>{triggerLabel}</span>
        <svg className="ui-dropdown-custom__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      {isOpen && !disabled && (
        <div className="ui-dropdown-custom__menu">
          <div className="ui-dropdown-custom__search">
            <input
              className="ui-dropdown-custom__search-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="ui-dropdown-custom__options">
            {loading ? (
              <div className="ui-dropdown-custom__no-results">Loading…</div>
            ) : list.length === 0 ? (
              <div className="ui-dropdown-custom__no-results">No results</div>
            ) : list.map((opt) => {
              const checked = selectedSet.has(String(opt.value));
              return (
                <div
                  key={opt.value}
                  className={`ui-dropdown-custom__option ${checked ? 'ui-dropdown-custom__option--selected' : ''}`}
                  onClick={() => onToggle && onToggle(opt)}
                >
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={checked} onChange={() => onToggle && onToggle(opt)} onClick={(e) => e.stopPropagation()} className="ui-checkbox" />
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="ui-dropdown-custom__pager">
            <button type="button" className="ui-dropdown-custom__pager-btn" disabled={loading || page <= 1} onClick={(e) => { e.stopPropagation(); load(page - 1, search); }}>← Prev</button>
            <span className="ui-dropdown-custom__pager-info">Page {page}</span>
            <button type="button" className="ui-dropdown-custom__pager-btn" disabled={loading || list.length < pageSize} onClick={(e) => { e.stopPropagation(); load(page + 1, search); }}>Next →</button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="work-state-chips">
          {selected.map((p) => (
            <span key={p.id} className="work-state-chip">
              {p.label}
              <button type="button" className="work-state-chip__remove" aria-label={`Remove ${p.label}`} onClick={() => onRemove && onRemove(p.id)}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
