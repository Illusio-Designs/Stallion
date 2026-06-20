'use client';
import React, { useEffect, useState } from 'react';

/**
 * Product media tile. Uses the page-scoped `.product-media-*` CSS classes
 * (defined in dashboard-products.css) rather than Tailwind utilities, because
 * those unlayered rules are the reliable, override-proof source of truth for
 * this gallery — Tailwind utilities lose to the project's unlayered page CSS.
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
    <div className="product-media-card">
      <span
        className={`product-media-status ${
          isAssigned ? 'product-media-status--assigned' : 'product-media-status--unassigned'
        }`}
      >
        {isAssigned ? 'Assigned' : 'Unassigned'}
      </span>

      {deletable && (
        <button
          type="button"
          className="product-media-remove"
          onClick={onDelete}
          disabled={loading}
          aria-label="Delete image"
          title="Delete image"
        >
          ✕
        </button>
      )}

      {imageUrl && !broken ? (
        <img
          src={imageUrl}
          alt={title || 'Product image'}
          className="product-thumb"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="product-thumb--empty">No image</div>
      )}

      <div className="product-media-meta">
        <span className="product-media-title" title={title}>{title}</span>
        <span className="product-media-sub">
          {subtitle || (isAssigned ? 'Assigned to product' : 'Not assigned')}
        </span>
      </div>
    </div>
  );
}
