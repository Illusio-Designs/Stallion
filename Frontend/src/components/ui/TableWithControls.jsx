"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import Button from "./Button";
import DropdownSelector from "./DropdownSelector";
import Pagination from "./Pagination";
import { SkeletonRows } from "./Skeleton";
import "../../styles/components/ui.css";

export default function TableWithControls({
  title = "Overview",
  columns = [], // [{key,label,render?,width?}]
  rows = [], // array of records
  defaultVisible = null, // array of keys
  onAddNew,
  onExport,
  onImport,
  secondaryActions = [],
  dateRange = null,
  onDateChange,
  dateFrom = null,
  dateTo = null,
  onDateRangeChange,
  rowSizeOptions = [8, 16, 24],
  selectable = true,
  addNewText = "Add New",
  exportText = "Export All Data",
  importText = "Import All Data",
  itemName = "Item",
  showSerialNumber = true, // Show serial number column by default
  showFilter = false, // Show filter icon
  filterContent = null, // React node to render in filter popover
  loading = false, // Show loading spinner when true
  // --- Optional server-side pagination ---
  // When serverPagination is true, `rows` is treated as the current page (already
  // fetched from the server). Internal slicing is disabled and the footer pager
  // is controlled by the parent via serverPage/serverPageCount/onServerPageChange.
  serverPagination = false,
  serverPage = 1,
  serverPageCount = 1,
  serverPageSize = 20,
  serverTotal = null,
  onServerPageChange,
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // Listen to global search from DashboardHeader
  useEffect(() => {
    const handler = (e) => {
      const q = (e.detail?.query || "").trim();
      setPage(1);
      setQuery(q);
    };
    window.addEventListener("globalSearchChanged", handler);
    return () => window.removeEventListener("globalSearchChanged", handler);
  }, []);
  const [pageSize, setPageSize] = useState(rowSizeOptions[0]);
  const [visible, setVisible] = useState(
    () => {
      const baseKeys = defaultVisible && defaultVisible.length
        ? defaultVisible
        : columns.map((c) => c.key);
      // Always include serial number if enabled
      if (showSerialNumber) {
        return new Set(['__serialNumber', ...baseKeys]);
      }
      return new Set(baseKeys);
    }
  );
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState(null); // key
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'
  // Filter menu state
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const filterPopoverRef = useRef(null);

  // Close filter popover on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handleOutsideClick = (e) => {
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(e.target) &&
        filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [filterOpen]);

  const filteredRows = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, query]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const va = a?.[sortBy];
      const vb = b?.[sortBy];
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      const na =
        typeof va === "number"
          ? va
          : parseFloat(String(va).replace(/[^0-9.\-]/g, ""));
      const nb =
        typeof vb === "number"
          ? vb
          : parseFloat(String(vb).replace(/[^0-9.\-]/g, ""));
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(va).localeCompare(String(vb));
    });
    if (sortDir === "desc") copy.reverse();
    return copy;
  }, [filteredRows, sortBy, sortDir]);

  const totalPages = serverPagination
    ? Math.max(1, serverPageCount)
    : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = useMemo(() => {
    // In server mode, `rows` already represents the current page - render as-is.
    if (serverPagination) return sortedRows;
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize, serverPagination]);

  // Effective page / page size used for serial numbers and the footer pager.
  const effectivePage = serverPagination ? serverPage : page;
  const effectivePageSize = serverPagination ? serverPageSize : pageSize;

  const toggleColumn = (key) => {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setVisible(next);
  };

  return (
    <div className="ui-table-container">
    <div className="ui-table">
      <div className="ui-table__header">
        <h4 className="ui-table__title">{title}</h4>
        <div className="ui-table__actions">
          {secondaryActions.map((action, idx) => (
            <Button
              key={`secondary-${idx}`}
              variant={action.variant || "secondary"}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
          {(onImport || onExport) && (
            <Button variant="secondary" onClick={onImport || onExport}>
              {importText || exportText}
            </Button>
          )}
          {onAddNew && <Button onClick={onAddNew}>{addNewText}</Button>}
        </div>
      </div>

      <div className="ui-table__controls">
        <div className="ui-table__control-row">
          <div className="ui-table__right">
            {(onDateRangeChange || onDateChange) && (
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onChange={(range) => {
                  onDateRangeChange?.(range);
                  if (onDateChange) {
                    const fmt = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                    onDateChange(range.from || range.to ? `${fmt(range.from)}${range.to ? ' – ' + fmt(range.to) : ''}` : '');
                  }
                }}
              />
            )}

            {!serverPagination && (
              <DropdownSelector
                options={rowSizeOptions.map((n) => ({
                  value: n,
                  label: `Show ${n} Row`,
                }))}
                value={pageSize}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              />
            )}

            {/* Filter Dropdown - appear below filter icon if open */}
            {showFilter && (
              <div style={{position:'relative', display:'inline-block'}}>
                <button
                  className="ui-pill"
                  ref={filterBtnRef}
                  title="Filters"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setFilterOpen((v) => !v)}
                  style={{ borderRadius: "50%", padding: "8px 6px" }}
                >
                  {/* Crisp Lucide/Material style filter icon */}
                  <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 5 21 5 14 12 14 19 10 19 10 12 3 5" />
                  </svg>
                </button>
                {filterOpen && filterContent && (
                  <div
                    ref={filterPopoverRef}
                    className="ui-filter-popover"
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      minWidth: 220,
                      background: '#fff',
                      border: '1px solid #E0E0E0',
                      borderRadius: 10,
                      boxShadow: '0 2px 12px rgba(24,18,101,.07)',
                      padding: 16,
                      zIndex: 50,
                    }}
                  >
                    {filterContent}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ui-table__scroll">
        <table>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '40px', padding: '20px 8px' }}>
                  <input
                    type="checkbox"
                    checked={
                      pageRows.length > 0 &&
                      pageRows.every((_, i) =>
                        selected.has((page - 1) * pageSize + i)
                      )
                    }
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) {
                        pageRows.forEach((_, i) =>
                          next.add((page - 1) * pageSize + i)
                        );
                      } else {
                        pageRows.forEach((_, i) =>
                          next.delete((page - 1) * pageSize + i)
                        );
                      }
                      setSelected(next);
                    }}
                  />
                </th>
              )}
              {showSerialNumber && visible.has('__serialNumber') && (
                <th style={{ width: '60px', padding: '20px 8px' }}>
                  <span className="ui-th">SR NO</span>
                </th>
              )}
              {columns
                .filter((c) => visible.has(c.key))
                .map((c) => {
                  const active = sortBy === c.key;
                  return (
                    <th
                      key={c.key}
                      style={c.width ? { width: c.width } : undefined}
                    >
                      <button
                        className={`ui-th ui-th__btn`}
                        onClick={() => {
                          const nextDir =
                            active && sortDir === "asc" ? "desc" : "asc";
                          setSortBy(c.key);
                          setSortDir(nextDir);
                        }}
                      >
                        <span>{c.label}</span>
                      </button>
                    </th>
                  );
                })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows
                rows={Math.min(pageSize, 8)}
                cols={
                  (selectable ? 1 : 0) +
                  (showSerialNumber && visible.has('__serialNumber') ? 1 : 0) +
                  columns.filter((c) => visible.has(c.key)).length
                }
              />
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    (selectable ? 1 : 0) +
                    (showSerialNumber && visible.has('__serialNumber') ? 1 : 0) +
                    columns.filter((c) => visible.has(c.key)).length
                  }
                  className="ui-empty"
                >
                  No data
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => {
              const serialNumber = (effectivePage - 1) * effectivePageSize + idx + 1;
              return (
                <tr key={idx}>
                  {selectable && (
                    <td style={{ width: '40px', padding: '18px 8px 0px' }}>
                      <input
                        type="checkbox"
                        checked={selected.has((page - 1) * pageSize + idx)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked)
                            next.add((page - 1) * pageSize + idx);
                          else next.delete((page - 1) * pageSize + idx);
                          setSelected(next);
                        }}
                      />
                    </td>
                  )}
                  {showSerialNumber && visible.has('__serialNumber') && (
                    <td style={{ width: '60px', padding: '18px 8px 0px' }}>{serialNumber}</td>
                  )}
                  {columns
                    .filter((c) => visible.has(c.key))
                    .map((c) => (
                      <td key={c.key} style={c.width ? { width: c.width } : undefined}>
                        {c.render
                          ? c.render(row[c.key], row)
                          : String(row[c.key] ?? "")}
                      </td>
                    ))}
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

     
    </div> <div className="ui-table__footer">
        <div className="ui-table__count">
          Showing {pageRows.length} Of {serverPagination ? (serverTotal ?? pageRows.length) : sortedRows.length} {itemName}
        </div>
        <div className="ui-table__pager">
          <Pagination
            page={effectivePage}
            pageCount={totalPages}
            onPageChange={serverPagination ? (onServerPageChange || (() => {})) : setPage}
          />
        </div>
        <div className="ui-page-goto">
          <span>Go To Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            className="ui-input ui-input--goto"
            defaultValue={effectivePage}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = parseInt(e.currentTarget.value || "1", 10);
                const target = Math.min(Math.max(1, val), totalPages);
                if (serverPagination) {
                  onServerPageChange?.(target);
                } else {
                  setPage(target);
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Working date-range picker: a pill that opens a popover with native date inputs.
// Calls onChange({ from, to }) with 'YYYY-MM-DD' strings (or null).
function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const hasRange = Boolean(from || to);
  const label = hasRange ? `${fmt(from) || '…'} – ${fmt(to) || '…'}` : 'Select dates';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="ui-pill" onClick={() => setOpen((v) => !v)} title="Filter by date">
        <span style={{ fontFamily: 'Spoof Trial', color: hasRange ? 'var(--color-text)' : 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>{label}</span>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }}>
          <path d="M8 2V5M16 2V5M3 9H21M5 5H19C20.105 5 21 5.895 21 7V19C21 20.105 20.105 21 19 21H5C3.895 21 3 20.105 3 19V7C3 5.895 3.895 5 5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid #E0E0E0', borderRadius: 10, boxShadow: '0 4px 16px rgba(24,18,101,.10)', padding: 14, zIndex: 60, minWidth: 240 }}
        >
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>From</label>
          <input type="date" className="ui-input" value={from || ''} max={to || undefined} onChange={(e) => onChange({ from: e.target.value || null, to })} style={{ width: '100%', marginBottom: 12 }} />
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>To</label>
          <input type="date" className="ui-input" value={to || ''} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value || null })} style={{ width: '100%', marginBottom: 12 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" onClick={() => onChange({ from: null, to: null })}>Clear</button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}