'use client';
import React, { useEffect, useState } from 'react';

/**
 * Product media tile. Product images are shot on a white background, so the
 * image is shown *contained* (never cropped) on a clean surface, with the
 * status pill overlaid on the image and a readable text bar below for the
 * model_no. Styled entirely with Tailwind.
 *
 * Props:
 * - imageUrl    image src (already a full, encoded URL)
 * - title       main label (e.g. model_no)
 * - subtitle    secondary label (e.g. brand · collection)
 * - status      'assigned' | 'unassigned'
 * - deletable   show the delete button
 * - onDelete    delete handler
 * - loading     disables the delete button while busy
 */
export default function MediaImageCard({
  imageUrl,
  title,
  subtitle,
  status = 'unassigned',
  deletable = false,
  onDelete,
  loading = false,
}) {
  const isAssigned = status === 'assigned';
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [imageUrl]);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Image — contained on white so the full product is visible */}
      <div className="relative aspect-square w-full bg-white p-4">
        {imageUrl && !broken ? (
          <img
            src={imageUrl}
            alt={title || 'Product image'}
            className="h-full w-full object-contain"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-text-subtle">
            No image
          </div>
        )}

        {/* Status badge — matches the app's soft badge style */}
        <span
          className={`absolute left-2.5 top-2.5 inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm ${
            isAssigned ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
          }`}
        >
          {isAssigned ? 'Assigned' : 'Unassigned'}
        </span>

        {/* Delete — revealed on hover (desktop), always visible on touch */}
        {deletable && (
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            aria-label="Delete image"
            title="Delete image"
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-sm text-[#dc2626] shadow-sm ring-1 ring-black/5 transition hover:bg-white hover:text-[#b91c1c] disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Text bar */}
      <div className="border-t border-border px-3.5 py-3">
        <p className="truncate text-sm font-semibold leading-snug text-text" title={title}>
          {title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-xs leading-none text-text-subtle">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${isAssigned ? 'bg-success' : 'bg-warning'}`}
          />
          {subtitle || (isAssigned ? 'Assigned to product' : 'Not assigned')}
        </p>
      </div>
    </div>
  );
}
