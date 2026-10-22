"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import Button from "./Button";
import DropdownSelector from "./DropdownSelector";
import Pagination from "./Pagination";
import { SkeletonRows } from "./Skeleton";
import DateRangePicker from "./DateRangePicker";
import { compareValues, detectColumnType, visibleSearchText } from "../../utils/tableSort";
import "../../styles/components/ui.css";

const ROW_ID_KEYS = [
  "id", "order_id", "party_id", "product_id", "salesman_id", "distributor_id",
  "expense_id", "event_id", "user_id", "supplier_id", "offer_id", "tray_id",
  "client_id", "_id", "uuid",
];
// Stable identity for a row (null when the row has no id).
function stableRowId(row) {
  if (!row || typeof row !== "object") return null;
  for (const k of ROW_ID_KEYS) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return `${k}:${v}`;
  }
  return null;
}

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
  rowSizeOptions = [20, 40, 60],
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
  // Server mode only: called (debounced) when the global search query changes,
  // so the parent can re-fetch page 1 with the search term. When provided, the
  // client-side row filter is skipped (the server already filtered).
  onServerSearch,
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
  const [gotoValue, setGotoValue] = useState("1");
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

  // Keep the latest onServerSearch in a ref so the debounce effect below does
  // NOT depend on its identity. Parents pass an inline arrow (new identity every
  // render), so depending on it would re-run this effect after every re-render —
  // including the re-render caused by changing pages — and fire onServerSearch
  // with the current query, snapping the list back to page 1. (This is what made
  // pagination appear broken.)
  const onServerSearchRef = useRef(onServerSearch);
  useEffect(() => { onServerSearchRef.current = onServerSearch; }, [onServerSearch]);

  // Server-side search: debounce the query and let the parent re-fetch. Fire
  // only when the QUERY actually changes (user typing / global search) — skip
  // the initial mount, where the parent already loads page 1.
  const didMountSearchRef = useRef(false);
  useEffect(() => {
    if (!serverPagination) return;
    if (!didMountSearchRef.current) { didMountSearchRef.current = true; return; }
    const t = setTimeout(() => onServerSearchRef.current?.(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, serverPagination]);

  const filteredRows = useMemo(() => {
    // In server-search mode the rows are already the filtered current page.
    if (serverPagination && onServerSearch) return rows;
    if (!query) return rows;
    const q = query.toLowerCase();
    const searchCols = columns.filter((c) => visible.has(c.key));
    return rows.filter((r) => visibleSearchText(r, searchCols).includes(q));
  }, [rows, query, serverPagination, onServerSearch, columns, visible]);

  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;
    const copy = [...filteredRows];
    // Real date / number / text comparison; blanks and "-" always last.
    const colType = detectColumnType(filteredRows, sortBy);
    copy.sort((a, b) => compareValues(a?.[sortBy], b?.[sortBy], sortDir, colType));
    return copy;
  }, [filteredRows, sortBy, sortDir]);

  const totalPages = serverPagination
    ? Math.max(1, serverPageCount)
    : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  // Always-valid page: derived from state, clamped into 1..totalPages.
  const safePage = serverPagination ? page : Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = useMemo(() => {
    // In server mode, `rows` already represents the current page - render as-is.
    if (serverPagination) return sortedRows;
    return sortedRows.slice(pageStart, pageStart + pageSize);
  }, [sortedRows, pageStart, pageSize, serverPagination]);

  // Keep the stored page in sync with the clamped value.
  useEffect(() => {
    if (!serverPagination && page !== safePage) setPage(safePage);
  }, [serverPagination, page, safePage]);

  // Reset to page 1 when the data set changes meaningfully (filter / tab /
  // date / country): first row differs or size changes by more than one row.
  // A single-row delete is only clamped, not reset.
  const dataSigRef = useRef(null);
  useEffect(() => {
    if (serverPagination) return;
    const first = sortedRows.length ? (stableRowId(sortedRows[0]) ?? "") : "";
    const prev = dataSigRef.current;
    dataSigRef.current = { first, len: sortedRows.length };
    if (!prev) return;
    if (prev.first !== first || Math.abs(prev.len - sortedRows.length) > 1) setPage(1);
  }, [sortedRows, serverPagination]);

  // Selection is keyed by stable row id (index fallback); drop vanished ids.
  const selKey = (row, absIdx) => stableRowId(row) ?? `idx:${absIdx}`;
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const valid = new Set(sortedRows.map((r, i) => selKey(r, i)));
      let changed = false;
      const next = new Set();
      prev.forEach((k) => { if (valid.has(k)) next.add(k); else changed = true; });
      return changed ? next : prev;
    });
  }, [sortedRows]);

  // Effective page / page size used for serial numbers and the footer pager.
  const effectivePage = serverPagination ? serverPage : safePage;

  // Go-to-page input mirrors the current page whenever it changes.
  useEffect(() => { setGotoValue(String(effectivePage)); }, [effectivePage]);
  const commitGoto = () => {
    const val = parseInt(gotoValue, 10);
    const target = Math.min(Math.max(1, Number.isFinite(val) ? val : effectivePage), totalPages);
    setGotoValue(String(target));
    if (serverPagination) onServerPageChange?.(target);
    else setPage(target);
  };
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
              <div className="relative inline-block">
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
                    aria-label="Select all rows on this page"
                    checked={
                      pageRows.length > 0 &&
                      pageRows.every((r, i) =>
                        selected.has(selKey(r, pageStart + i))
                      )
                    }
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) {
                        pageRows.forEach((r, i) =>
                          next.add(selKey(r, pageStart + i))
                        );
                      } else {
                        pageRows.forEach((r, i) =>
                          next.delete(selKey(r, pageStart + i))
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
                      style={c.width ? { minWidth: c.width } : undefined}
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
                <tr key={selKey(row, pageStart + idx)}>
                  {selectable && (
                    <td data-col="skip" style={{ width: '40px', padding: '18px 8px 0px' }}>
                      <input
                        type="checkbox"
                        aria-label={`Select row ${pageStart + idx + 1}`}
                        checked={selected.has(selKey(row, pageStart + idx))}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked)
                            next.add(selKey(row, pageStart + idx));
                          else next.delete(selKey(row, pageStart + idx));
                          setSelected(next);
                        }}
                      />
                    </td>
                  )}
                  {showSerialNumber && visible.has('__serialNumber') && (
                    <td data-col="skip" style={{ width: '60px', padding: '18px 8px 0px' }}>{serialNumber}</td>
                  )}
                  {columns
                    .filter((c) => visible.has(c.key))
                    .map((c, ci) => (
                      <td
                        key={c.key}
                        data-label={c.label}
                        data-col={c.key === 'action' || c.key === 'actions' ? 'action' : (ci === 0 ? 'primary' : undefined)}
                        style={c.width ? { minWidth: c.width } : undefined}
                      >
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
            aria-label="Go to page number"
            className="ui-input ui-input--goto"
            value={gotoValue}
            onChange={(e) => setGotoValue(e.target.value)}
            onBlur={commitGoto}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitGoto();
            }}
          />
        </div>
      </div>
    </div>
  );
}
