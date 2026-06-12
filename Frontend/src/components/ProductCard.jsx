import React, { useState } from 'react';
import '../styles/components/ProductCard.css';
import { addToCart } from '../services/cartService';
import { showAddToCartSuccess } from '../services/notificationService';

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
      return '/images/products/spac1.webp';
    }
    
    // If already a full URL (starts with http), use it as-is (but clean it first)
    if (productImage.startsWith('http')) {
      // Remove any trailing JSON syntax characters (backslashes, brackets, quotes)
      let cleaned = productImage.replace(/([\]"\\])+$/, '');
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
      // Use the specified URL format: https://stallion.nishree.com/uploads/products/${filename}
      return `https://stallion.nishree.com/uploads/products/${filename}`;
    }
    
    // Fallback to default image
    return '/images/products/spac1.webp';
  };

  const imageUrl = getImageUrl();
  
  const handleImageError = (e) => {
    console.error('[ProductCard] Image failed to load:', imageUrl);
    // Fallback to default image
    e.target.src = '/images/products/spac1.webp';
  };

  return (
    <div className="product-card">
      <div className="product-image">
        <img 
          src={imageUrl} 
          alt={productName}
          onError={handleImageError}
        />
      </div>
      <h3 className="product-name">{productName}</h3>
      <div className="color-options">
        {colors.map((colorItem, index) => (
          <div
            key={index}
            className={`color-swatch ${activeColor === index ? 'active' : ''}`}
            style={{backgroundColor: colorItem.color}}
            onClick={() => handleColorClick(index)}
            title={colorItem.name}
          ></div>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <div className="pc-qty" role="group" aria-label="Quantity selector">
          <button type="button" className="pc-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity">&minus;</button>
          <span className="pc-qty-value">{qty}</span>
          <button type="button" className="pc-qty-btn" onClick={() => setQty(q => q + 1)} aria-label="Increase quantity">+</button>
        </div>

        <button type="button" className="pc-add-btn" onClick={handleAddToCart}>
          ADD TO CART
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

