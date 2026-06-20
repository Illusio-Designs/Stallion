import React, { useState } from 'react';
import '../styles/components/ProductCard.css';
import { addToCart } from '../services/cartService';
import { showAddToCartSuccess } from '../services/notificationService';
import { encodeUploadName } from '../utils/imageUrl';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const FALLBACK_IMAGE = '/images/products/spac1.webp';

// Product images are served by the backend under /uploads/products.
// Derive the host from the configured API URL (NEXT_PUBLIC_API_URL) so it
// follows the environment instead of a hard-coded legacy domain.
const getUploadBase = () => {
  // Prefer the dedicated image host (same as the Media gallery), then fall back
  // to the API origin, so product images resolve consistently everywhere.
  const imgBase = process.env.NEXT_PUBLIC_IMAGE_BASE_URL;
  if (imgBase) {
    return `${imgBase.replace(/\/+$/, '')}/uploads/products`;
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.stallioneyewear.in/api';
  const origin = envUrl.replace(/\/+$/, '').replace(/\/api$/, '');
  return `${origin}/uploads/products`;
};

const ProductCard = ({
  productId,
  productName,
  productImage,
  whp,
  mrp,
  colors = [
    { color: '#000000', name: 'Black' },
    { color: '#E5E5E5', name: 'Grey' },
    { color: '#FFB6C1', name: 'Pink' }
  ],
  onViewMore
}) => {
  const [activeColor, setActiveColor] = useState(0);
  const [qty, setQty] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const handleColorClick = (colorIndex) => {
    setActiveColor(colorIndex);
  };

  const handleViewMoreClick = () => {
    if (onViewMore) {
      // Pass both productId and model_no (productName is model_no)
      onViewMore(productId, productName);
    }
  };

  const handleAddToCart = () => {
    addToCart({
      id: productId,
      name: productName,
      image: imageUrl,
      lenseColour: colors[activeColor]?.name || '',
      whp: whp != null ? whp : 0,
      mrp: mrp != null ? mrp : 0,
      quantity: qty,
    });
    showAddToCartSuccess(productName, qty);
  };

  // Construct image URL - extract filename from path and use the specified format
  const getImageUrl = () => {
    if (!productImage) {
      return FALLBACK_IMAGE;
    }

    // If already a full URL (starts with http), use it as-is (but clean it first)
    if (productImage.startsWith('http')) {
      // Remove any trailing JSON syntax characters (backslashes, brackets, quotes)
      let cleaned = productImage.replace(/([\]"\\])+$/, '');
      // Re-point legacy upload URLs (old host) at the current backend host.
      const uploadMatch = cleaned.match(/\/uploads\/products\/([^/?#]+)$/);
      if (uploadMatch) {
        return `${getUploadBase()}/${encodeUploadName(uploadMatch[1])}`;
      }
      return cleaned;
    }

    // Remove any query parameters or fragments
    let cleanPath = productImage.split('?')[0].split('#')[0];

    // Remove any trailing JSON syntax characters (like \]", ]", \", etc.)
    cleanPath = cleanPath.replace(/([\]"\\])+$/, '');

    // Extract filename from path
    // Handles paths like:
    // - "/uploads/products/spac2-1766058948930.webp" -> "spac2-1766058948930.webp"
    // - "/Users/.../uploads/products/filename.jpg" -> "filename.jpg"
    // - "filename.webp" -> "filename.webp"
    const parts = cleanPath.split('/');
    let filename = parts[parts.length - 1];

    // Clean filename: remove any remaining JSON syntax characters
    filename = filename.replace(/([\]"\\])+$/, '');

    // Make sure we got a valid filename (not empty, has extension)
    if (filename && filename.includes('.')) {
      return `${getUploadBase()}/${encodeUploadName(filename)}`;
    }

    // Fallback to default image
    return FALLBACK_IMAGE;
  };

  const imageUrl = getImageUrl();

  const handleImageError = (e) => {
    // Swap to the local placeholder once; guard against an onError loop if the
    // placeholder itself ever fails (avoids console spam + infinite re-render).
    if (e.currentTarget.dataset.fallbackApplied === 'true') {
      // The local placeholder failed too — fall back to a graceful
      // "image unavailable" affordance instead of leaving blank space.
      setImgBroken(true);
      return;
    }
    e.currentTarget.dataset.fallbackApplied = 'true';
    e.currentTarget.src = FALLBACK_IMAGE;
    setImgLoaded(true);
  };

  // Price: show selling price (whp) with MRP struck through when discounted.
  const hasPrice = whp != null && Number(whp) > 0;
  const hasMrp = mrp != null && Number(mrp) > 0;
  const isDiscounted = hasPrice && hasMrp && Number(mrp) > Number(whp);

  return (
    <div className="product-card group box-border h-full bg-surface border border-border rounded-lg p-4 shadow-sm transition duration-300 ease-[ease] motion-reduce:transition-none hover:-translate-y-1 hover:shadow-lg focus-within:shadow-[var(--shadow-md),var(--focus-ring)]">
      <div className={`product-image relative overflow-hidden rounded-md${imgBroken ? ' aspect-square' : ''}`}>
        {!imgLoaded && !imgBroken && <span className="pc-image-placeholder absolute inset-0" aria-hidden="true" />}
        {imgBroken ? (
          <div
            className="pc-image-unavailable absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-muted text-text-subtle"
            role="img"
            aria-label="Image unavailable"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-3.5-3.5L9 20" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
            <span className="text-[length:var(--text-xs)] font-medium tracking-[var(--tracking-label)] uppercase">Image unavailable</span>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={productName}
            loading="lazy"
            className={`pc-image-img transition duration-300 ease-[ease] motion-reduce:transition-none ${imgLoaded ? 'is-loaded opacity-100 group-hover:scale-105' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={handleImageError}
          />
        )}
      </div>
      <h3 className="product-name block overflow-hidden [-webkit-box-orient:vertical] [display:-webkit-box] [-webkit-line-clamp:2] [line-clamp:2] min-h-[calc(2*var(--leading-snug)*var(--text-md))]">{productName}</h3>

      {hasPrice && (
        <div className="pc-price flex items-baseline flex-wrap gap-2 mb-3">
          <span className="pc-price-label self-center text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle">WHP</span>
          <span className="pc-price-now text-[length:var(--text-md)] font-semibold text-text leading-[var(--leading-tight)]">{formatPrice(whp)}</span>
          {isDiscounted && (
            <span className="pc-price-mrp text-[length:var(--text-sm)] font-normal text-text-subtle line-through">{formatPrice(mrp)}</span>
          )}
        </div>
      )}

      <div className="color-options flex flex-wrap items-center gap-3 mt-2 mb-3">
        {colors.map((colorItem, index) => (
          <button
            type="button"
            key={index}
            className={`color-swatch h-[22px] w-[22px] flex-none cursor-pointer appearance-none rounded-pill border p-0 shadow-xs transition duration-[120ms] ease-[ease] hover:scale-110 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${activeColor === index ? 'active border-surface shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-primary)]' : 'border-border-strong'}`}
            style={{backgroundColor: colorItem.color}}
            onClick={() => handleColorClick(index)}
            title={colorItem.name}
            aria-label={`Select colour ${colorItem.name}`}
            aria-pressed={activeColor === index}
          ></button>
        ))}
      </div>
      <div className="pc-actions flex w-full flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          className="pc-icon-btn inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-md border border-primary bg-surface text-primary transition duration-[120ms] ease-[ease] hover:bg-primary hover:text-text-on-primary active:scale-[0.94] disabled:cursor-not-allowed disabled:bg-surface disabled:text-primary disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          onClick={handleViewMoreClick}
          title="View details"
          aria-label="View product details"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <div className="pc-qty inline-flex h-10 flex-none items-center overflow-hidden rounded-md border border-border-strong bg-surface" role="group" aria-label="Quantity selector">
          <button
            type="button"
            className="pc-qty-btn h-full w-9 cursor-pointer border-none bg-primary-soft text-primary text-[length:var(--text-lg)] leading-none transition duration-[120ms] ease-[ease] hover:not-disabled:bg-primary-soft-hover active:not-disabled:bg-primary-soft-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-subtle focus-visible:relative focus-visible:z-[1] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >&minus;</button>
          <span className="pc-qty-value min-w-8 text-center text-[length:var(--text-base)] font-semibold text-text" aria-live="polite">{qty}</span>
          <button
            type="button"
            className="pc-qty-btn h-full w-9 cursor-pointer border-none bg-primary-soft text-primary text-[length:var(--text-lg)] leading-none transition duration-[120ms] ease-[ease] hover:not-disabled:bg-primary-soft-hover active:not-disabled:bg-primary-soft-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-subtle focus-visible:relative focus-visible:z-[1] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            onClick={() => setQty(q => q + 1)}
            aria-label="Increase quantity"
          >+</button>
        </div>

        <button type="button" className="pc-add-btn flex-[1_1_120px] min-h-10 cursor-pointer rounded-md border-none bg-primary px-3 text-text-on-primary text-[length:var(--text-sm)] font-semibold tracking-[var(--tracking-label)] transition duration-[120ms] ease-[ease] hover:not-disabled:bg-primary-hover active:not-disabled:translate-y-px active:not-disabled:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary disabled:opacity-55 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]" onClick={handleAddToCart}>
          ADD TO CART
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
