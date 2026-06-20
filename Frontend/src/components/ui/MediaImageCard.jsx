'use client';
import React, { useEffect, useState } from 'react';

/**
 * Modern media tile: a full-bleed product image with a readability gradient,
 * a status pill (assigned/unassigned), the model_no as the title, and an
 * optional delete action revealed on hover. Styled entirely with Tailwind.
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
  const accent = isAssigned ? 'var(--color-success)' : 'var(--color-warning)';
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [imageUrl]);

  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-grey-100 shadow-sm ring-1 ring-black/5 transition-shadow duration-200 hover:shadow-lg">
      {imageUrl && !broken ? (
        <img
          src={imageUrl}
          alt={title || 'Product image'}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-text-subtle">
          No image
        </div>
      )}

      {/* Readability gradient for the bottom label */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      {/* Status pill */}
      <span
        className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur"
        style={{ color: accent }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
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
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm text-[#dc2626] shadow-sm backdrop-blur transition hover:bg-white hover:text-[#b91c1c] disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
        >
          ✕
        </button>
      )}

      {/* Bottom label */}
      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <h3 className="truncate text-sm font-semibold text-white drop-shadow-sm" title={title}>
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-white/85">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
