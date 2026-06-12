import React, { useState, useRef, useEffect, useCallback } from "react";
import "../styles/pages/ProductDetail.css";
import Skeleton from "../components/ui/Skeleton";
import { addToCart } from "../services/cartService";
import { showAddToCartSuccess } from "../services/notificationService";
import { parseProductPath } from "../utils/dashboardRoutes";
import {
  getProductModels,
  getProductById,
  getBrands,
  getGenders,
  getShapes,
  getFrameColors,
  getLensColors,
  getFrameMaterials,
  getLensMaterials,
  getFrameTypes
} from "../services/apiService";

// Shared state for viewMode to communicate with Breadcrumb
let sharedViewMode = "list";
let sharedSetViewMode = null;

export const getSharedViewMode = () => sharedViewMode;
export const setSharedViewMode = (mode) => {
  sharedViewMode = mode;
  if (sharedSetViewMode) sharedSetViewMode(mode);
};
export const registerViewModeSetter = (setter) => {
  sharedSetViewMode = setter;
};

// Render helper: degrade missing / placeholder spec values to a clean em dash.
const display = (value) => {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  if (str === "" || str === "N/A") return "—";
  return str;
};

const ProductDetail = ({ productId: propProductId = null }) => {
  // Get productId and model_no from URL if not provided as prop (for direct navigation)
  const [productId, setProductId] = useState(() => {
    if (propProductId) return propProductId;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get("id");
      // product_id can be UUID (string) or number
      return id || null;
    }
    return null;
  });
  const [modelNo, setModelNo] = useState(() => {
    if (typeof window !== "undefined") {
      // Clean route /product/<model_no>, with legacy ?model_no= fallback.
      const fromPath = parseProductPath(window.location.pathname);
      if (fromPath) return fromPath;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("model_no") || null;
    }
    return null;
  });

  // Update modelNo and productId when URL changes (e.g., after login redirect)
  useEffect(() => {
    const checkUrlParams = () => {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get("id");
        const modelNoParam = parseProductPath(window.location.pathname) || urlParams.get("model_no");

        if (id && id !== productId) {
          setProductId(id);
        }
        if (modelNoParam && modelNoParam !== modelNo) {
          setModelNo(modelNoParam);
        }
      }
    };
    
    // Check immediately
    checkUrlParams();
    
    // Also listen for popstate events (back/forward navigation)
    if (typeof window !== "undefined") {
      window.addEventListener('popstate', checkUrlParams);
      return () => window.removeEventListener('popstate', checkUrlParams);
    }
  }, [productId, modelNo]);
  const [viewMode, setViewMode] = useState(() => {
    const mode = sharedViewMode || "list";
    return mode;
  });
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [quantities, setQuantities] = useState({});
  const [editingQuantities, setEditingQuantities] = useState({});
  const [productVariations, setProductVariations] = useState([]);
  const [addedIds, setAddedIds] = useState({}); // transient "Added" feedback per variation
  const addedTimersRef = useRef({});
  const [rawModels, setRawModels] = useState([]); // Store raw API models for re-transformation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Lookup data for resolving IDs to names
  const [brands, setBrands] = useState([]);
  const [genders, setGenders] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [frameColors, setFrameColors] = useState([]);
  const [lensColors, setLensColors] = useState([]);
  const [frameMaterials, setFrameMaterials] = useState([]);
  const [lensMaterials, setLensMaterials] = useState([]);
  const [frameTypes, setFrameTypes] = useState([]);

  // Register setter and sync with shared state
  useEffect(() => {
    registerViewModeSetter((mode) => {
      setViewMode(mode);
    });
  }, []);

  // Clear any pending "Added" feedback timers on unmount.
  useEffect(() => {
    const timers = addedTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Lookup tables are fetched lazily and ONLY when the product models don't
  // already include the attribute names (see the effect that watches rawModels).
  // Fetched once, in parallel, and cached at the service layer.
  const lookupsLoadedRef = useRef(false);
  const ensureLookups = async () => {
    if (lookupsLoadedRef.current) return;
    lookupsLoadedRef.current = true;
    try {
      const [brandsData, gendersData, shapesData, frameColorsData, lensColorsData, frameMaterialsData, lensMaterialsData, frameTypesData] = await Promise.all([
        getBrands().catch(() => []),
        getGenders().catch(() => []),
        getShapes().catch(() => []),
        getFrameColors().catch(() => []),
        getLensColors().catch(() => []),
        getFrameMaterials().catch(() => []),
        getLensMaterials().catch(() => []),
        getFrameTypes().catch(() => [])
      ]);

      setBrands(brandsData || []);
      setGenders(gendersData || []);
      setShapes(shapesData || []);
      setFrameColors(frameColorsData || []);
      setLensColors(lensColorsData || []);
      setFrameMaterials(frameMaterialsData || []);
      setLensMaterials(lensMaterialsData || []);
      setFrameTypes(frameTypesData || []);
    } catch (err) {
      lookupsLoadedRef.current = false; // allow retry
      console.error('Error fetching lookup data:', err);
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSharedViewMode(mode);
  };
  const [sliderPosition, setSliderPosition] = useState(0);
  const sliderRef = useRef(null);

  // Quantity management functions
  const getQuantity = (variationId) => {
    return quantities[variationId] || 1;
  };

  const updateQuantity = (variationId, newQuantity) => {
    if (newQuantity < 1) newQuantity = 1; // Minimum quantity is 1
    setQuantities((prev) => ({
      ...prev,
      [variationId]: newQuantity,
    }));
  };

  const handleQuantityIncrease = (variationId, e) => {
    e.stopPropagation(); // Prevent card click when clicking button
    const currentQty = getQuantity(variationId);
    updateQuantity(variationId, currentQty + 1);
  };

  const handleQuantityDecrease = (variationId, e) => {
    e.stopPropagation(); // Prevent card click when clicking button
    const currentQty = getQuantity(variationId);
    if (currentQty > 1) {
      updateQuantity(variationId, currentQty - 1);
    }
  };

  const handleQuantityInputChange = (variationId, value, e) => {
    if (e) e.stopPropagation();
    const parsed = parseInt(value, 10);
    const newQuantity = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
    updateQuantity(variationId, newQuantity);
  };

  const handleAddToCart = (variation, e) => {
    if (e) {
      e.stopPropagation(); // Prevent card click when clicking button
    }
    const quantity = getQuantity(variation.id);
    addToCart({
      id: variation.id,
      name: variation.name,
      image: variation.image,
      lenseColour: variation.lenseColour,
      whp: variation.whp,
      quantity: quantity,
    });
    // Show success notification
    showAddToCartSuccess(
      `${variation.name} (${variation.lenseColour})`,
      quantity
    );
    // Transient inline "Added" confirmation on the button itself.
    setAddedIds((prev) => ({ ...prev, [variation.id]: true }));
    if (addedTimersRef.current[variation.id]) {
      clearTimeout(addedTimersRef.current[variation.id]);
    }
    addedTimersRef.current[variation.id] = setTimeout(() => {
      setAddedIds((prev) => {
        const { [variation.id]: _, ...rest } = prev;
        return rest;
      });
    }, 1600);
  };

  // Transform API response to match component's expected format
  const transformProductModels = React.useCallback((models) => {
    if (!models || models.length === 0) {
      setProductVariations([]);
      setLoading(false);
      return;
    }

    const transformed = models.map((model, index) => {
      // Helper to extract filename from path
      const extractFilename = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') return null;
        
        // Remove any query parameters or fragments
        let cleanPath = imagePath.split('?')[0].split('#')[0];
        
        // Remove any trailing JSON syntax characters (like \]", ]", \", etc.)
        // Remove backslashes, closing brackets, and quotes at the end
        cleanPath = cleanPath.replace(/([\]"\\])+$/, '');
        
        // Extract filename from path (handles "/uploads/products/filename.webp" or full paths)
        const parts = cleanPath.split('/');
        let filename = parts[parts.length - 1];
        
        // Clean filename: remove any remaining JSON syntax characters
        filename = filename.replace(/([\]"\\])+$/, '');
        
        // Make sure we got a valid filename (not empty, has extension)
        if (filename && filename.includes('.')) {
          return filename;
        }
        
        return null;
      };

      // Helper to parse image_urls - handle JSON string format like "[\"/uploads/products/spac2-1766058948930.webp\"]"
      const parseImageUrls = (imageUrls) => {
        if (!imageUrls) return null;
        
        // If it's already an array, return it
        if (Array.isArray(imageUrls)) {
          return imageUrls;
        }
        
        // If it's a string, try to parse it as JSON
        if (typeof imageUrls === 'string') {
          try {
            // Try parsing once
            let parsed = JSON.parse(imageUrls);
            
            // Handle double-encoded strings (some APIs return double-encoded JSON)
            if (typeof parsed === 'string') {
              try {
                parsed = JSON.parse(parsed);
              } catch (e) {
                // If second parse fails, use the first parsed value
              }
            }
            
            // If parsed result is an array, return it
            if (Array.isArray(parsed)) {
              return parsed;
            }
            
            // If parsed result is a string, wrap it in an array
            if (typeof parsed === 'string') {
              return [parsed];
            }
          } catch (e) {
            // If parsing fails, treat the string itself as the image path
            if (imageUrls.trim().length > 0 && imageUrls !== '[]') {
              return [imageUrls];
            }
          }
        }
        
        return null;
      };

      // Helper to get image URL
      const getImageUrl = (imageUrls, fallbackImageUrl) => {
        // Handle image_urls (can be array or JSON string)
        const parsedUrls = parseImageUrls(imageUrls);
        if (parsedUrls && parsedUrls.length > 0) {
          const firstImage = parsedUrls[0];
          if (firstImage) {
            const filename = extractFilename(firstImage);
            if (filename) {
              return `https://stallion.nishree.com/uploads/products/${filename}`;
            }
          }
        }
        
        // Handle single image_url string (fallback)
        if (fallbackImageUrl) {
          const filename = extractFilename(fallbackImageUrl);
          if (filename) {
            return `https://stallion.nishree.com/uploads/products/${filename}`;
          }
        }
        
        // Default fallback
        return '/images/products/spac1.webp';
      };

      // Format price with currency
      const formatPrice = (price) => {
        if (!price) return '₹0';
        const numPrice = typeof price === 'string' ? parseFloat(price) : price;
        return `₹${numPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      // Format quantity
      const formatQty = (qty) => {
        if (qty === null || qty === undefined) return '0';
        return qty.toString();
      };

      // Lookup related data by IDs
      const brand = brands.find(b => (b.brand_id || b.id) === model.brand_id);
      const gender = genders.find(g => (g.gender_id || g.id) === model.gender_id);
      const shape = shapes.find(s => (s.shape_id || s.id) === model.shape_id);
      const frameColor = frameColors.find(fc => (fc.frame_color_id || fc.id) === model.frame_color_id);
      const lensColor = lensColors.find(lc => (lc.lens_color_id || lc.id) === model.lens_color_id);
      const frameMaterial = frameMaterials.find(fm => (fm.frame_material_id || fm.id) === model.frame_material_id);
      const lensMaterial = lensMaterials.find(lm => (lm.lens_material_id || lm.id) === model.lens_material_id);
      const frameType = frameTypes.find(ft => (ft.frame_type_id || ft.id) === model.frame_type_id);

      return {
        id: model.product_id || model.id || index + 1,
        name: model.model_no || 'Safety Goggles',
        brand: model.brand_name || model.brand?.brand_name || brand?.brand_name || brand?.name || 'N/A',
        model: model.model_no || 'Model',
        type: model.frame_type_name || model.frame_type?.frame_type || frameType?.frame_type || frameType?.name || 'N/A',
        gender: model.gender_name || model.gender?.gender_name || gender?.gender_name || gender?.name || 'N/A',
        shape: model.shape_name || model.shape?.shape_name || shape?.shape_name || shape?.name || 'N/A',
        frameColour: model.frame_color_name || model.frame_color?.frame_color || frameColor?.frame_color || frameColor?.name || 'N/A',
        frameMaterial: model.frame_material_name || model.frame_material?.frame_material || frameMaterial?.frame_material || frameMaterial?.name || 'N/A',
        lenseColour: model.lens_color_name || model.lens_color?.lens_color || lensColor?.lens_color || lensColor?.name || 'N/A',
        lenseMaterial: model.lens_material_name || model.lens_material?.lens_material || lensMaterial?.lens_material || lensMaterial?.name || 'N/A',
        size: model.size_mm || 'N/A',
        qty: formatQty(model.total_qty || model.warehouse_qty || 0),
        image: getImageUrl(model.image_urls, model.image_url),
        mrp: formatPrice(model.mrp),
        whp: formatPrice(model.whp),
      };
    });

    setProductVariations(transformed);
    setLoading(false);
  }, [brands, genders, shapes, frameColors, lensColors, frameMaterials, lensMaterials, frameTypes]);

  // Fetch product models when model_no is available
  useEffect(() => {
    const fetchProductModels = async () => {
      // Re-read URL params in case they changed (e.g., after login redirect)
      let currentModelNo = modelNo;
      let currentProductId = productId;
      
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const urlModelNo = urlParams.get("model_no");
        const urlProductId = urlParams.get("id");
        
        if (urlModelNo && urlModelNo !== currentModelNo) {
          currentModelNo = urlModelNo;
          setModelNo(urlModelNo);
        }
        if (urlProductId && urlProductId !== currentProductId) {
          currentProductId = urlProductId;
          setProductId(urlProductId);
        }
      }
      
      if (!currentModelNo) {
        // If no model_no, try to get it from productId by fetching products
        if (currentProductId) {
          try {
            setLoading(true);
            setError(null);
            // Fetch the single product directly by id (instead of pulling a page
            // of products and searching) to resolve its model_no.
            const resp = await getProductById(currentProductId);
            const product = resp?.data || resp;
            if (product && product.model_no) {
              setModelNo(product.model_no);
              // Fetch product models with the found model_no
              const models = await getProductModels(product.model_no);
              setRawModels(models);
              // transformProductModels will be called by the useEffect that watches rawModels and lookup data
            } else {
              setError('Product not found');
              setLoading(false);
            }
          } catch (err) {
            console.error('Error fetching product:', err);
            setError('Failed to load product');
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const models = await getProductModels(currentModelNo);
        setRawModels(models);
        // transformProductModels will be called by the useEffect that watches rawModels and lookup data
      } catch (err) {
        console.error('Error fetching product models:', err);
        setError('Failed to load product models');
        setLoading(false);
      }
    };

    fetchProductModels();
  }, [modelNo, productId]);

  // Transform models when rawModels or lookup data changes
  useEffect(() => {
    if (rawModels.length > 0) {
      transformProductModels(rawModels);
    }
  }, [rawModels, transformProductModels]);

  // Fetch the lookup tables ONLY if the product models don't already include
  // the attribute names. If the API returns names, no lookup calls are made.
  useEffect(() => {
    if (rawModels.length === 0) return;
    const allHaveNames = rawModels.every(m =>
      (m.brand_name || m.brand?.brand_name) &&
      (m.gender_name || m.gender?.gender_name) &&
      (m.shape_name || m.shape?.shape_name) &&
      (m.frame_type_name || m.frame_type?.frame_type) &&
      (m.frame_color_name || m.frame_color?.frame_color) &&
      (m.lens_color_name || m.lens_color?.lens_color) &&
      (m.frame_material_name || m.frame_material?.frame_material) &&
      (m.lens_material_name || m.lens_material?.lens_material)
    );
    if (!allHaveNames) ensureLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawModels]);

  const currentProduct = productVariations[selectedVariation] || null;
  const totalVariations = productVariations.length;

  // Update display variation based on selected variation
  useEffect(() => {
    // When variation is selected, ensure it's reflected in the display
  }, [selectedVariation]);

  // Responsive slider logic: adjust how many cards are visible per row
  const [cardsPerRow, setCardsPerRow] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w <= 426) return 1;
      if (w <= 768) return 2;
      return 3;
    }
    return 3;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let newCards = 3;
      if (w <= 426) newCards = 1;
      else if (w <= 768) newCards = 2;
      else newCards = 3;
      setCardsPerRow(newCards);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep sliderPosition valid when cardsPerRow or totalVariations change
  useEffect(() => {
    const maxPos = Math.max(0, Math.ceil(totalVariations / cardsPerRow) - 1);
    if (sliderPosition > maxPos) setSliderPosition(maxPos);
  }, [cardsPerRow, totalVariations]);

  const needsSliderArrows = totalVariations > cardsPerRow;
  const maxSliderPosition = Math.max(0, Math.ceil(totalVariations / cardsPerRow) - 1);

  const scrollSlider = (direction) => {
    const newPosition = direction === 'next'
      ? Math.min(sliderPosition + 1, maxSliderPosition)
      : Math.max(sliderPosition - 1, 0);
    setSliderPosition(newPosition);
  };

  const handleVariationClick = (index) => {
    setSelectedVariation(index);
  };

  // Roving keyboard navigation for the thumbnail gallery: arrow keys move
  // focus + selection, Home/End jump to ends. Enter/Space select (handled
  // inline). Purely additive UX — no data/prop changes.
  const thumbnailRefs = useRef([]);
  const handleThumbnailKeyDown = useCallback(
    (e, index, count) => {
      let next = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % count;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + count) % count;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleVariationClick(index);
        return;
      }
      if (next !== null) {
        e.preventDefault();
        handleVariationClick(next);
        const node = thumbnailRefs.current[next];
        if (node && typeof node.focus === "function") node.focus();
      }
    },
    []
  );

  const getVisibleVariations = () => {
    if (viewMode === 'list') return productVariations;
    // Grid view: show a window of productVariations according to cardsPerRow and sliderPosition
    const start = sliderPosition * cardsPerRow;
    return productVariations.slice(start, start + cardsPerRow);
  };

  const getDisplayVariation = () => {
    if (viewMode === "list") {
      return null; // In list view, all variations are displayed
    }
    // Always show the selected variation's features
    // In grid view, always show currentProduct (selected variation) in features section
    return currentProduct;
  };

  const visibleVariations = getVisibleVariations();
  const displayVariation = getDisplayVariation();
  const needsSlider = viewMode === "grid" && needsSliderArrows; // Only need slider arrows for >3 variations

  // Show loading state (shimmer placeholder mimicking the detail layout)
  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="pd-skeleton" aria-busy="true" aria-live="polite">
          <Skeleton className="pd-skeleton__media" height="100%" radius={12} />
          <div className="pd-skeleton__panel">
            <Skeleton className="pd-skeleton__line" width="60%" height={28} radius={6} />
            <Skeleton className="pd-skeleton__line" width="40%" height={20} radius={6} />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={`pd-skeleton-${i}`}
                className="pd-skeleton__line"
                width={`${80 - i * 6}%`}
                height={14}
                radius={6}
              />
            ))}
            <Skeleton className="pd-skeleton__cta" width={160} height={44} radius={8} />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="product-detail-page">
        <div className="ui-state ui-state--error" role="alert">
          <div className="ui-state__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="ui-state__title">Couldn&apos;t load this product</p>
          <p className="ui-state__desc">{error}. Please check your connection and try again.</p>
          <div className="ui-state__actions">
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--md"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
            >
              <span className="ui-btn__label">Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (productVariations.length === 0) {
    return (
      <div className="product-detail-page">
        <div className="ui-state ui-state--empty">
          <div className="ui-state__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <p className="ui-state__title">No variations found</p>
          <p className="ui-state__desc">This product has no available variations to show right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      {/* List View */}
      {viewMode === "list" && (
        <div className="list-view-container">
          {productVariations.map((variation, index) => (
            <div key={variation.id} className="list-view-item">
              <div className="list-item-image">
                <img 
                  src={variation.image || '/images/products/spac1.webp'} 
                  alt={variation.name}
                  onError={(e) => {
                    // Fallback to default image if image fails to load
                    if (e.target.src !== '/images/products/spac1.webp') {
                      e.target.src = '/images/products/spac1.webp';
                    }
                  }}
                />
              </div>
              <div className="list-item-details">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Brand</span>
                    <span className="detail-value">{display(variation.brand)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Model</span>
                    <span className="detail-value">{display(variation.model)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{display(variation.type)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Gender</span>
                    <span className="detail-value">{display(variation.gender)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Shape</span>
                    <span className="detail-value">{display(variation.shape)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Frame Colour</span>
                    <span className="detail-value">
                      {display(variation.frameColour)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Frame Material</span>
                    <span className="detail-value">
                      {display(variation.frameMaterial)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Lense Colour</span>
                    <span className="detail-value">
                      {display(variation.lenseColour)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Lense Material</span>
                    <span className="detail-value">
                      {display(variation.lenseMaterial)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Size</span>
                    <span className="detail-value">{display(variation.size)}</span>
                  </div>
                  {/* QTY label/value as a normal detail cell */}
                  <div className="detail-item">
                    <span className="detail-label">QTY</span>
                    <span className="detail-value">{display(variation.qty)}</span>
                  </div>
                  {/* Quantity selector in 5th column */}
                  <div className="quantity-selector-wrapper">
                    <div className="quantity-selector">
                      <button
                        type="button"
                        className="qty-btn minus"
                        aria-label={`Decrease quantity for ${variation.name}`}
                        disabled={getQuantity(variation.id) <= 1}
                        onClick={(e) => handleQuantityDecrease(variation.id, e)}
                      >
                        <span aria-hidden="true">&minus;</span>
                      </button>
                      <input
                        className="qty-number"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        aria-label={`Quantity for ${variation.name}`}
                        value={
                          editingQuantities[variation.id] !== undefined
                            ? editingQuantities[variation.id]
                            : getQuantity(variation.id)
                        }
                        onChange={(e) => {
                          setEditingQuantities((q) => ({
                            ...q,
                            [variation.id]: e.target.value,
                          }));
                        }}
                        onBlur={(e) => {
                          const val = editingQuantities[variation.id];
                          const num = parseInt(val, 10);
                          handleQuantityInputChange(
                            variation.id,
                            !val || isNaN(num) || num < 1 ? "1" : val,
                            e
                          );
                          setEditingQuantities((q) => {
                            const { [variation.id]: _, ...rest } = q;
                            return rest;
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="qty-btn plus"
                        aria-label={`Increase quantity for ${variation.name}`}
                        onClick={(e) => handleQuantityIncrease(variation.id, e)}
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </div>
                  {/* Add to Cart button in 6th column */}
                  <div className="add-to-cart-wrapper">
                    <button
                      type="button"
                      className={`add-to-cart-btn-list ${addedIds[variation.id] ? "is-added" : ""}`}
                      onClick={(e) => handleAddToCart(variation, e)}
                    >
                      {addedIds[variation.id] ? "Added ✓" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid-view-container">
          {/* Main Product Display Area */}
          <div className="grid-main-section">
            {/* Slider Section */}
            {totalVariations > 3 && (
              <div className="variation-slider-section">
                {needsSlider && (
                  <button
                    type="button"
                    className="slider-arrow left"
                    aria-label="Previous variations"
                    onClick={() => scrollSlider("prev")}
                    disabled={sliderPosition === 0}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M15 18L9 12L15 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                <div className="variation-slider" ref={sliderRef}>
                  <div className="variation-slider-track">
                    {visibleVariations.map((variation, index) => {
                      // Calculate actual index based on which variations are shown
                      let actualIndex;
                      if (totalVariations === 4) {
                        actualIndex = index; // indices 0, 1, 2
                      } else if (totalVariations === 5) {
                        actualIndex = sliderPosition === 0 ? index : 3 + index; // 0-2 or 3-4
                      } else if (totalVariations === 6) {
                        actualIndex = sliderPosition === 0 ? index : 3 + index; // 0-2 or 3-5
                      } else {
                        actualIndex = index;
                      }
                      return (
                        <div
                          key={variation.id}
                          className={`variation-card ${
                            selectedVariation === actualIndex ? "active" : ""
                          }`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selectedVariation === actualIndex}
                          aria-label={`Select variation ${variation.name}`}
                          onClick={() => handleVariationClick(actualIndex)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleVariationClick(actualIndex);
                            }
                          }}
                        >
                          <div className="variation-card-image">
                            <img 
                              src={variation.image || '/images/products/spac1.webp'} 
                              alt={variation.name}
                              onError={(e) => {
                                // Fallback to default image if image fails to load
                                if (e.target.src !== '/images/products/spac1.webp') {
                                  e.target.src = '/images/products/spac1.webp';
                                }
                              }}
                            />
                          </div>
                          <div className="variation-card-details">
                            <h4 className="variation-card-title">
                              {display(variation.name)}
                            </h4>
                            <div className="variation-specs">
                              <div className="variation-spec-item">
                                <span className="variation-spec-label">
                                  Frame Colour
                                </span>
                                <span className="variation-spec-value">
                                  {display(variation.frameColour)}
                                </span>
                              </div>
                              <div className="variation-spec-item">
                                <span className="variation-spec-label">
                                  Lense Colour
                                </span>
                                <span className="variation-spec-value">
                                  {display(variation.lenseColour)}
                                </span>
                              </div>
                            </div>
                            <div
                              className="quantity-selector-small"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="qty-btn-small minus"
                                aria-label={`Decrease quantity for ${variation.name}`}
                                disabled={getQuantity(variation.id) <= 1}
                                onClick={(e) =>
                                  handleQuantityDecrease(variation.id, e)
                                }
                              >
                                <span aria-hidden="true">&minus;</span>
                              </button>
                              <input
                                className="qty-number-small"
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                aria-label={`Quantity for ${variation.name}`}
                                onClick={(e) => e.stopPropagation()}
                                value={
                                  editingQuantities[variation.id] !== undefined
                                    ? editingQuantities[variation.id]
                                    : getQuantity(variation.id)
                                }
                                onChange={(e) => {
                                  setEditingQuantities((q) => ({
                                    ...q,
                                    [variation.id]: e.target.value,
                                  }));
                                }}
                                onBlur={(e) => {
                                  const val = editingQuantities[variation.id];
                                  const num = parseInt(val, 10);
                                  handleQuantityInputChange(
                                    variation.id,
                                    !val || isNaN(num) || num < 1 ? "1" : val,
                                    e
                                  );
                                  setEditingQuantities((q) => {
                                    const { [variation.id]: _, ...rest } = q;
                                    return rest;
                                  });
                                }}
                              />
                              <button
                                type="button"
                                className="qty-btn-small plus"
                                aria-label={`Increase quantity for ${variation.name}`}
                                onClick={(e) =>
                                  handleQuantityIncrease(variation.id, e)
                                }
                              >
                                <span aria-hidden="true">+</span>
                              </button>
                            </div>
                            <button
                              type="button"
                              className={`add-to-cart-btn-small ${addedIds[variation.id] ? "is-added" : ""}`}
                              onClick={(e) => handleAddToCart(variation, e)}
                            >
                              {addedIds[variation.id] ? "Added ✓" : "Add to Cart"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {needsSlider && (
                  <button
                    type="button"
                    className="slider-arrow right"
                    aria-label="Next variations"
                    onClick={() => scrollSlider("next")}
                    disabled={sliderPosition >= maxSliderPosition}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Main Product Display */}
            <div className="main-product-display">
              <div className="main-product-image">
                <img 
                  src={currentProduct.image || '/images/products/spac1.webp'} 
                  alt={currentProduct.name}
                  onError={(e) => {
                    // Fallback to default image if image fails to load
                    if (e.target.src !== '/images/products/spac1.webp') {
                      e.target.src = '/images/products/spac1.webp';
                    }
                  }}
                />
              </div>
              <div className="main-product-info">
                <h2 className="product-title">{display(currentProduct.name)}</h2>
                <div className="color-selectors" role="group" aria-label="Select colour variation">
                  {productVariations.slice(0, 3).map((variation, index) => (
                    <button
                      type="button"
                      key={variation.id}
                      className={`color-swatch ${
                        selectedVariation === index ? "active" : ""
                      }`}
                      aria-label={`Colour variation ${index + 1}`}
                      aria-pressed={selectedVariation === index}
                      onClick={() => handleVariationClick(index)}
                      style={{
                        backgroundColor:
                          index === 0
                            ? "#000000"
                            : index === 1
                            ? "#FFFFFF"
                            : "#FFB6C1",
                      }}
                    ></button>
                  ))}
                </div>
                <div className="price-info">
                  <div className="price-item">
                    <span className="price-label">MRP</span>
                    <span className="price-value">{display(currentProduct.mrp)}</span>
                  </div>
                  <div className="price-item">
                    <span className="price-label">WHP</span>
                    <span className="price-value">{display(currentProduct.whp)}</span>
                  </div>
                </div>
                <div className="main-selector-action-row">
                  <div className="quantity-selector-small">
                    <button
                      type="button"
                      className="qty-btn-small minus"
                      aria-label="Decrease quantity"
                      disabled={getQuantity(currentProduct.id) <= 1}
                      onClick={(e) =>
                        handleQuantityDecrease(currentProduct.id, e)
                      }
                    >
                      <span aria-hidden="true">&minus;</span>
                    </button>
                    <input
                      className="qty-number-small"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      aria-label="Quantity"
                      value={
                        editingQuantities[currentProduct.id] !== undefined
                          ? editingQuantities[currentProduct.id]
                          : getQuantity(currentProduct.id)
                      }
                      onChange={e => {
                        setEditingQuantities(q => ({ ...q, [currentProduct.id]: e.target.value }));
                      }}
                      onBlur={e => {
                        const val = editingQuantities[currentProduct.id];
                        const num = parseInt(val, 10);
                        handleQuantityInputChange(currentProduct.id, (!val || isNaN(num) || num < 1) ? '1' : val, e);
                        setEditingQuantities(q => {
                          const { [currentProduct.id]: _, ...rest } = q;
                          return rest;
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="qty-btn-small plus"
                      aria-label="Increase quantity"
                      onClick={(e) =>
                        handleQuantityIncrease(currentProduct.id, e)
                      }
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`add-to-cart-btn-small ${addedIds[currentProduct.id] ? "is-added" : ""}`}
                    onClick={(e) => handleAddToCart(currentProduct, e)}
                  >
                    {addedIds[currentProduct.id] ? "Added ✓" : "Add to Cart"}
                  </button>
                </div>
              </div>
            </div>

            {/* Variation Thumbnails */}
            <div
              className="variation-thumbnails"
              role="listbox"
              aria-label="Product variation thumbnails"
            >
              {productVariations.map((variation, index) => (
                <div
                  key={variation.id}
                  ref={(node) => {
                    thumbnailRefs.current[index] = node;
                  }}
                  className={`thumbnail ${
                    selectedVariation === index ? "active" : ""
                  }`}
                  role="option"
                  tabIndex={selectedVariation === index ? 0 : -1}
                  aria-selected={selectedVariation === index}
                  aria-label={`View ${variation.name} ${variation.lenseColour}`}
                  onClick={() => handleVariationClick(index)}
                  onKeyDown={(e) =>
                    handleThumbnailKeyDown(e, index, productVariations.length)
                  }
                >
                  <img
                    src={variation.image || '/images/products/spac1.webp'}
                    alt={`${variation.name} - ${variation.lenseColour}`}
                    onError={(e) => {
                      // Fallback to default image if image fails to load
                      if (e.target.src !== '/images/products/spac1.webp') {
                        e.target.src = '/images/products/spac1.webp';
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Features Box - Always shows selected variation's features */}
          {viewMode === "grid" && displayVariation && (
            <div className="features-box-standalone">
              <h3 className="features-title">Features</h3>
              <div className="features-grid">
                <div className="features-column">
                  <div className="feature-item">
                    <span className="feature-label">Brand</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.brand)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Type</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.type)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Gender</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.gender)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Shape</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.shape)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Size</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.size)}
                    </span>
                  </div>
                </div>
                <div className="features-column">
                  <div className="feature-item">
                    <span className="feature-label">Frame Colour</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.frameColour)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Frame Material</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.frameMaterial)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Lense Colour</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.lenseColour)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">Lense Material</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.lenseMaterial)}
                    </span>
                  </div>
                  <div className="feature-item">
                    <span className="feature-label">QTY</span>
                    <span className="feature-separator">-</span>
                    <span className="feature-value">
                      {display(displayVariation.qty)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
