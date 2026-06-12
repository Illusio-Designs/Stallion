import React, { useState } from 'react';
import '../styles/components/ProductCard.css';
import { addToCart } from '../services/cartService';
import { showAddToCartSuccess } from '../services/notificationService';

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
        return `${getUploadBase()}/${uploadMatch[1]}`;
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
      return `${getUploadBase()}/${filename}`;
    }

    // Fallback to default image
    return FALLBACK_IMAGE;
  };

  const imageUrl = getImageUrl();

  const handleImageError = (e) => {
    // Swap to the local placeholder once; guard against an onError loop if the
    // placeholder itself ever fails (avoids console spam + infinite re-render).
    if (e.currentTarget.dataset.fallbackApplied === 'true') return;
    e.currentTarget.dataset.fallbackApplied = 'true';
    e.currentTarget.src = FALLBACK_IMAGE;
    setImgLoaded(true);
  };

  // Price: show selling price (whp) with MRP struck through when discounted.
  const hasPrice = whp != null && Number(whp) > 0;
  const hasMrp = mrp != null && Number(mrp) > 0;
  const isDiscounted = hasPrice && hasMrp && Number(mrp) > Number(whp);

  return (
    <div className="product-card">
      <div className="product-image">
        {!imgLoaded && <span className="pc-image-placeholder" aria-hidden="true" />}
        <img
          src={imageUrl}
          alt={productName}
          loading="lazy"
          className={`pc-image-img${imgLoaded ? ' is-loaded' : ''}`}
          onLoad={() => setImgLoaded(true)}
          onError={handleImageError}
        />
      </div>
      <h3 className="product-name">{productName}</h3>

      {hasPrice && (
        <div className="pc-price">
          <span className="pc-price-label">WHP</span>
          <span className="pc-price-now">{formatPrice(whp)}</span>
          {isDiscounted && (
            <span className="pc-price-mrp">{formatPrice(mrp)}</span>
          )}
        </div>
      )}

      <div className="color-options">
        {colors.map((colorItem, index) => (
          <button
            type="button"
            key={index}
            className={`color-swatch ${activeColor === index ? 'active' : ''}`}
            style={{backgroundColor: colorItem.color}}
            onClick={() => handleColorClick(index)}
            title={colorItem.name}
            aria-label={`Select colour ${colorItem.name}`}
            aria-pressed={activeColor === index}
          ></button>
        ))}
      </div>
      <div className="pc-actions">
        <button
          type="button"
          className="pc-icon-btn"
          onClick={handleViewMoreClick}
          title="View details"
          aria-label="View product details"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <div className="pc-qty" role="group" aria-label="Quantity selector">
          <button
            type="button"
            className="pc-qty-btn"
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="Decrease quantity"
          >&minus;</button>
          <span className="pc-qty-value" aria-live="polite">{qty}</span>
          <button
            type="button"
            className="pc-qty-btn"
            onClick={() => setQty(q => q + 1)}
            aria-label="Increase quantity"
          >+</button>
        </div>

        <button type="button" className="pc-add-btn" onClick={handleAddToCart}>
          ADD TO CART
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
