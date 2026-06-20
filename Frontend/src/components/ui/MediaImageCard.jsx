'use client';
import React, { useEffect, useState } from 'react';

/**
 * Product media tile. Product images are shot on a white background, so the
 * image is shown *contained* (never cropped). A readable status chip overlays
 * the image and the model_no sits in a compact text bar below. Tailwind only.
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
  const dotClass = isAssigned ? 'bg-success' : 'bg-warning';
  const textClass = isAssigned ? 'text-success' : 'text-warning';
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [imageUrl]);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Image — contained on white (no crop) */}
      <div className="relative aspect-[4/3] w-full bg-white">
        {imageUrl && !broken ? (
          <img
            src={imageUrl}
            alt={title || 'Product image'}
            className="absolute inset-0 h-full w-full object-contain p-3"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-text-subtle">
            No image
          </div>
        )}

        {/* Status chip — white pill with a coloured dot so it reads clearly on
            the white product shot */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-pill bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide shadow-sm ring-1 ring-border backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          <span className={textClass}>{isAssigned ? 'Assigned' : 'Unassigned'}</span>
        </span>

        {/* Delete — revealed on hover (desktop), always visible on touch */}
        {deletable && (
          <button
            type="button"
            onClick={onDelete}
            disabled={loading}
            aria-label="Delete image"
            title="Delete image"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-xs text-[#dc2626] shadow-sm ring-1 ring-border transition hover:bg-white hover:text-[#b91c1c] disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
          >
            ✕
          </button>
        )}
      </div>

      {/* Text bar */}
      <div className="border-t border-border px-3 py-2">
        <p className="truncate text-[13px] font-semibold leading-snug text-text" title={title}>
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-none text-text-subtle">
          {subtitle || (isAssigned ? 'Assigned to product' : 'Not assigned')}
        </p>
      </div>
    </div>
  );
}
