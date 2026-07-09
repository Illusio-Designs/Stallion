'use client';
import React, { useEffect, useRef, useState } from 'react';

/**
 * A polished single-file upload field: a click / drag-and-drop dropzone that,
 * once a file is chosen, swaps to a compact card showing an image thumbnail (or
 * a file icon for PDFs), the name + size, and Change / Remove actions.
 *
 * Props:
 *  - label, hint, accept, required
 *  - file: the current File object (or null)
 *  - onChange(fileOrNull)
 */
export default function FileUpload({ label, hint, accept, required = false, file = null, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Build/revoke an object URL for image previews without leaking.
  useEffect(() => {
    if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [file]);

  const pick = () => inputRef.current && inputRef.current.click();
  const take = (files) => { const f = files && files[0]; if (f) onChange(f); };

  const prettySize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="ui-label">
          {label}{required && <span className="text-error"> *</span>}
        </label>
      )}

      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={pick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); take(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
            dragOver ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface-muted hover:border-primary'
          }`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" />
            </svg>
          </span>
          <span className="text-[length:var(--text-sm)] font-medium text-text">Click or drag file to upload</span>
          {hint && <span className="text-[length:var(--text-xs)] text-text-muted">{hint}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border-strong bg-surface p-2.5">
          {previewUrl ? (
            <img src={previewUrl} alt={file.name} className="h-11 w-11 flex-none rounded-md border border-border object-cover" />
          ) : (
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-md bg-primary-soft text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
              </svg>
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[length:var(--text-sm)] font-medium text-text">{file.name}</p>
            <p className="m-0 text-[length:var(--text-xs)] text-text-muted">{prettySize(file.size)}</p>
          </div>
          <button type="button" onClick={pick} className="flex-none rounded-md border border-border-strong bg-surface px-2.5 py-1 text-[length:var(--text-xs)] font-medium text-text transition hover:bg-surface-muted focus:outline-none focus-visible:shadow-[var(--focus-ring)]">Change</button>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove file" className="flex-none rounded-md p-1.5 text-text-muted transition hover:bg-error-soft hover:text-error focus:outline-none focus-visible:shadow-[var(--focus-ring)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
