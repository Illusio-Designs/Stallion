import React, { useMemo, useState } from "react";
import "../styles/pages/dashboard-analytics.css";
import Button from "../components/ui/Button";
import TableWithControls from "../components/ui/TableWithControls";
import Modal from "../components/ui/Modal";
import RowActions from "../components/ui/RowActions";

const AnalyticsReports = () => {
  const [dateRange, setDateRange] = useState("Feb 25, 2025 - Mar 25, 2025");

  // Columns similar to other pages (serial id, client, type of checking, reason)
  const [editRow, setEditRow] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const columns = useMemo(
    () => [
      { key: "serial", label: "SERIAL ID" },
      { key: "client", label: "CLIENT NAME" },
      { key: "type", label: "TYPE OF CHECKING" },
      { key: "reason", label: "REASON" },
      { key: 'action', label: 'ACTION', render: (_v, row) => (
        <RowActions onView={() => console.log('view visit', row)} onEdit={() => setEditRow(row)} onDelete={() => console.log('delete visit', row)} />
      ) },
    ],
    []
  );

  const rows = useMemo(
    () =>
      Array.from({ length: 64 }).map((_, i) => ({
        serial: `#${420500 + i}`,
        client: i % 2 ? "XYZ Optical" : "ABC Pharma",
        type: i % 3 ? "Order" : "Visit",
        reason:
          "Lorem ipsum dolor sit amet consectetur. Et to tristique augue.",
      })),
    []
  );

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        {/* No API configured — this page currently renders placeholder data */}
        <div className="analytics-noapi flex items-start gap-3 rounded-lg border border-warning bg-warning-soft px-4 py-3" role="status">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="m-0 text-[length:var(--text-sm)] leading-[var(--leading-normal)] text-text">
            <strong className="font-semibold">No API configured for Reports &amp; Analytics.</strong> The figures and table below are placeholder data — connect an analytics endpoint to show live targets, achievements, and visits.
          </p>
        </div>
        {/* Summary cards */}
        <div className="dash-row analytics-summary grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="dash-card metric analytics-card flex flex-col gap-1 bg-surface border border-border rounded-lg shadow-sm p-5 col-span-1 sm:col-span-6 lg:col-span-3">
            <h4 className="m-0 text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">Total Target</h4>
            <div className="metric-value text-xl font-bold leading-tight tracking-[-0.01em] text-text">₹30,00,000</div>
          </div>
          <div className="dash-card metric analytics-card flex flex-col gap-1 bg-surface border border-border rounded-lg shadow-sm p-5 col-span-1 sm:col-span-6 lg:col-span-3">
            <h4 className="m-0 text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">Achieve Target</h4>
            <div className="metric-value text-xl font-bold leading-tight tracking-[-0.01em] text-text">₹17,50,000</div>
          </div>
          <div className="dash-card metric analytics-card flex flex-col gap-1 bg-surface border border-border rounded-lg shadow-sm p-5 col-span-1 sm:col-span-6 lg:col-span-3">
            <h4 className="m-0 text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">Due Target</h4>
            <div className="metric-value text-xl font-bold leading-tight tracking-[-0.01em] text-text">₹12,50,000</div>
          </div>
          <div className="dash-card metric analytics-card flex flex-col gap-1 bg-surface border border-border rounded-lg shadow-sm p-5 col-span-1 sm:col-span-6 lg:col-span-3">
            <h4 className="m-0 text-xs font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">Completed Percentage</h4>
            <div className="metric-value text-xl font-bold leading-tight tracking-[-0.01em] text-text">65%</div>
          </div>
        </div>

        {/* Table area */}
        <div className="dash-page w-full">
          <div className="dash-container flex flex-col gap-4">
            <div className="dash-row grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              <div className="dash-card full bg-surface border border-border rounded-lg shadow-sm p-0 col-span-full">
                {rows.length === 0 ? (
                  <div className="ui-state ui-state--empty">
                    <div className="ui-state__icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18" />
                        <path d="M7 16l4-5 3 3 4-6" />
                      </svg>
                    </div>
                    <p className="ui-state__title">No visits yet</p>
                    <p className="ui-state__desc">There are no visits or reports to show for this period. Add a new visit to start tracking your analytics.</p>
                    <div className="ui-state__actions">
                      <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Visit</button>
                    </div>
                  </div>
                ) : (
                  <TableWithControls
                    title="Today's Visit"
                    columns={columns}
                    rows={rows}
                    onAddNew={() => setOpenAdd(true)}
                    addNewText="Add New Visit"
                    onImport={() => console.log('Import All Data')}
                    importText="Import All Data"
                  />
                )}
              </div>
            </div>
          </div>
          <Modal
            open={openAdd}
            onClose={() => setOpenAdd(false)}
            title="Add New Visit"
            footer={(
              <>
                <button className="ui-btn ui-btn--secondary" onClick={() => setOpenAdd(false)}>Cancel</button>
                <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(false)}>Save</button>
              </>
            )}
          >
            <div className="ui-form">
              <div className="form-group">
                <label className="ui-label">Client</label>
                <input className="ui-input" placeholder="Client name" />
              </div>
              <div className="form-group">
                <label className="ui-label">Type of Checking</label>
                <input className="ui-input" placeholder="Order / Visit" />
              </div>
              <div className="form-group form-group--full">
                <label className="ui-label">Reason</label>
                <input className="ui-input" placeholder="Reason" />
              </div>
            </div>
          </Modal>
          <Modal
            open={!!editRow}
            onClose={() => setEditRow(null)}
            title="Edit Visit"
            footer={(
              <>
                <button className="ui-btn ui-btn--secondary" onClick={() => setEditRow(null)}>Cancel</button>
                <button className="ui-btn ui-btn--primary" onClick={() => setEditRow(null)}>Update</button>
              </>
            )}
          >
            <div className="ui-form">
              <div className="form-group">
                <label className="ui-label">Client</label>
                <input className="ui-input" defaultValue={editRow?.client} />
              </div>
              <div className="form-group">
                <label className="ui-label">Type of Checking</label>
                <input className="ui-input" defaultValue={editRow?.type} />
              </div>
              <div className="form-group form-group--full">
                <label className="ui-label">Reason</label>
                <input className="ui-input" defaultValue={editRow?.reason} />
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsReports;
