import React from 'react';
import '../../styles/components/ui.css';

// Tooltip label utilities reproducing .ui-tt (positioning/hover handled by .has-tt CSS)
const ttClass =
  'ui-tt absolute left-1/2 bottom-[calc(100%+0.5rem)] -translate-x-1/2 translate-y-1 ' +
  'bg-grey-900 text-white px-2 py-1 rounded-sm text-[length:var(--text-xs)] whitespace-nowrap ' +
  'opacity-0 pointer-events-none shadow-md transition duration-200 ease-[ease] z-[10000]';

// Reusable row action buttons: only renders buttons for handlers provided.
// Uses the plain-CSS .row-action-btn class so the icon colour is guaranteed
// (not subject to Tailwind layer/theme-token resolution).
export default function RowActions({ onView, onEdit, onDownload, onDelete, onUpload }) {
  return (
    <div className="relative z-[1] flex items-center gap-1.5">
      {onView && (
        <button type="button" aria-label="View" className="row-action-btn has-tt relative" onClick={onView}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className={ttClass}>View</span>
        </button>
      )}
      {onEdit && (
        <button type="button" aria-label="Edit" className="row-action-btn has-tt relative" onClick={onEdit}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={ttClass}>Edit</span>
        </button>
      )}
      {onDownload && (
        <button type="button" aria-label="Download" className="row-action-btn has-tt relative" onClick={onDownload}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M7 11l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className={ttClass}>Download</span>
        </button>
      )}
      {onDelete && (
        <button type="button" aria-label="Delete" className="row-action-btn has-tt relative" onClick={onDelete}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 6l-.868 13.142A2 2 0 0 1 16.018 21H7.982a2 2 0 0 1-2.114-1.858L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={ttClass}>Delete</span>
        </button>
      )}
      {onUpload && (
        <button type="button" aria-label="Upload Image" className="row-action-btn has-tt relative" onClick={onUpload}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5l6 6M12 5L6 11M12 5v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={ttClass}>Upload Image</span>
        </button>
      )}
    </div>
  );
}
