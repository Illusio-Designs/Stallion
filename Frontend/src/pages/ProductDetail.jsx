import React, { useState, useRef, useEffect, useCallback } from "react";
import "../styles/pages/ProductDetail.css";
import Skeleton from "../components/ui/Skeleton";
import { addToCart } from "../services/cartService";
import { showAddToCartSuccess } from "../services/notificationService";
import { parseProductPath } from "../utils/dashboardRoutes";
import { encodeUploadName } from "../utils/imageUrl";
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
  // Track the src of the main image that failed even after the local placeholder
  // fallback, so we can show a graceful "image unavailable" affordance. Keyed by
  // src so selecting a different variation gives its image a fresh attempt.
  const [brokenMainImageSrc, setBrokenMainImageSrc] = useState(null);
  
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

      // Helper to get image URL. Use the SAME base as the Media gallery page
      // (NEXT_PUBLIC_IMAGE_BASE_URL) so images resolve to the real upload host
      // instead of a hard-coded legacy domain.
      const imageBaseUrl = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://api.stallioneyewear.in').replace(/\/$/, '');
      const getImageUrl = (imageUrls, fallbackImageUrl) => {
        // Handle image_urls (can be array or JSON string)
        const parsedUrls = parseImageUrls(imageUrls);
        if (parsedUrls && parsedUrls.length > 0) {
          const firstImage = parsedUrls[0];
          if (firstImage) {
            const filename = extractFilename(firstImage);
            if (filename) {
              return `${imageBaseUrl}/uploads/products/${encodeUploadName(filename)}`;
            }
          }
        }

        // Handle single image_url string (fallback)
        if (fallbackImageUrl) {
          const filename = extractFilename(fallbackImageUrl);
          if (filename) {
            return `${imageBaseUrl}/uploads/products/${filename}`;
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
        brand: model.brand?.brand_name || model.brand_name || brand?.brand_name || brand?.name || 'N/A',
        model: model.model_no || 'Model',
        type: model.frame_type?.frame_type || model.frame_type_name || frameType?.frame_type || frameType?.name || 'N/A',
        gender: model.gender?.gender_name || model.gender_name || gender?.gender_name || gender?.name || 'N/A',
        shape: model.shape?.shape_name || model.shape_name || shape?.shape_name || shape?.name || 'N/A',
        frameColour: model.frame_color?.frame_color || model.frame_color_name || frameColor?.frame_color || frameColor?.name || 'N/A',
        frameMaterial: model.frame_material?.frame_material || model.frame_material_name || frameMaterial?.frame_material || frameMaterial?.name || 'N/A',
        lenseColour: model.lens_color?.lens_color || model.lens_color_name || lensColor?.lens_color || lensColor?.name || 'N/A',
        lenseMaterial: model.lens_material?.lens_material || model.lens_material_name || lensMaterial?.lens_material || lensMaterial?.name || 'N/A',
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
      <div className="product-detail-page bg-primary-active px-[5%] py-8 min-h-[calc(100vh-200px)]">
        <div className="pd-skeleton grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6 md:gap-8 p-6 bg-surface rounded-lg shadow-sm" aria-busy="true" aria-live="polite">
          <Skeleton className="pd-skeleton__media block min-h-[240px] md:min-h-[340px]" height="100%" radius={12} />
          <div className="pd-skeleton__panel flex flex-col gap-3">
            <Skeleton className="pd-skeleton__line block" width="60%" height={28} radius={6} />
            <Skeleton className="pd-skeleton__line block" width="40%" height={20} radius={6} />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={`pd-skeleton-${i}`}
                className="pd-skeleton__line block"
                width={`${80 - i * 6}%`}
                height={14}
                radius={6}
              />
            ))}
            <Skeleton className="pd-skeleton__cta block mt-4" width={160} height={44} radius={8} />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="product-detail-page bg-primary-active px-[5%] py-8 min-h-[calc(100vh-200px)]">
        <div className="ui-state ui-state--error bg-surface rounded-lg shadow-sm my-4 mx-auto max-w-[560px]" role="alert">
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
      <div className="product-detail-page bg-primary-active px-[5%] py-8 min-h-[calc(100vh-200px)]">
        <div className="ui-state ui-state--empty bg-surface rounded-lg shadow-sm my-4 mx-auto max-w-[560px]">
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
    <div className="product-detail-page bg-primary-active px-[3%] py-3 sm:px-[4%] sm:py-5 md:py-6 lg:py-7 xl:px-[5%] xl:py-8 min-h-[calc(100vh-200px)]">
      {/* List View */}
      {viewMode === "list" && (
        <div className="list-view-container flex flex-col gap-5">
          {productVariations.map((variation, index) => (
            <div key={variation.id} className="list-view-item bg-surface rounded-lg p-4 sm:p-5 lg:p-5 xl:p-6 grid grid-cols-1 sm:grid-cols-[160px_1fr] lg:grid-cols-[220px_1fr] xl:grid-cols-[280px_1fr] gap-4 sm:gap-4 xl:gap-6 items-start border border-border shadow-sm transition duration-200 hover:shadow-md">
              <div className="list-item-image w-full h-[180px] sm:h-[180px] lg:h-[200px] xl:h-[240px] flex items-center justify-center bg-surface-muted rounded-md overflow-hidden p-4">
                <img
                  src={variation.image || '/images/products/spac1.webp'}
                  alt={variation.name}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    // Fallback to default image if image fails to load
                    if (e.target.src !== '/images/products/spac1.webp') {
                      e.target.src = '/images/products/spac1.webp';
                    }
                  }}
                />
              </div>
              <div className="list-item-details flex flex-col gap-5 justify-between">
                <div className="detail-grid grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-y-4 md:gap-x-5 lg:grid-cols-5 lg:gap-y-5 lg:gap-x-6">
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Brand</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.brand)}</span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Model</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.model)}</span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Type</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.type)}</span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Gender</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.gender)}</span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Shape</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.shape)}</span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Frame Colour</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">
                      {display(variation.frameColour)}
                    </span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Frame Material</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">
                      {display(variation.frameMaterial)}
                    </span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Lense Colour</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">
                      {display(variation.lenseColour)}
                    </span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Lense Material</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">
                      {display(variation.lenseMaterial)}
                    </span>
                  </div>
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">Size</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.size)}</span>
                  </div>
                  {/* QTY label/value as a normal detail cell */}
                  <div className="detail-item flex flex-col gap-1 min-w-0">
                    <span className="detail-label font-normal text-text-subtle text-[length:var(--text-xs)] tracking-[var(--tracking-label)] uppercase">QTY</span>
                    <span className="detail-value text-text font-medium text-[length:var(--text-base)] leading-[var(--leading-snug)] break-words">{display(variation.qty)}</span>
                  </div>
                  {/* Quantity selector in 5th column */}
                  <div className="quantity-selector-wrapper flex items-end">
                    <div className="quantity-selector w-full flex items-center justify-between gap-1 bg-surface border border-border-strong rounded-md p-1">
                      <button
                        type="button"
                        className="qty-btn minus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Decrease quantity for ${variation.name}`}
                        disabled={getQuantity(variation.id) <= 1}
                        onClick={(e) => handleQuantityDecrease(variation.id, e)}
                      >
                        <span aria-hidden="true">&minus;</span>
                      </button>
                      <input
                        className="qty-number text-center font-semibold text-text bg-transparent text-[length:var(--text-md)] px-2 border-none w-full min-w-[48px] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 focus-visible:outline-none focus-visible:rounded-sm focus-visible:shadow-[var(--focus-ring)]"
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
                        className="qty-btn plus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Increase quantity for ${variation.name}`}
                        onClick={(e) => handleQuantityIncrease(variation.id, e)}
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </div>
                  {/* Add to Cart button in 6th column */}
                  <div className="add-to-cart-wrapper flex items-end">
                    <button
                      type="button"
                      className={`add-to-cart-btn-list w-full min-h-[44px] px-6 py-3 rounded-md text-[length:var(--text-base)] font-semibold cursor-pointer border transition duration-200 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${addedIds[variation.id] ? "is-added bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active active:border-primary-active"}`}
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
        <div className="grid-view-container flex flex-col gap-8">
          {/* Main Product Display Area */}
          <div className="grid-main-section flex flex-col gap-8">
            {/* Slider Section */}
            {totalVariations > 3 && (
              <div className="variation-slider-section relative flex items-center gap-4">
                {needsSlider && (
                  <button
                    type="button"
                    className="slider-arrow left bg-surface text-primary border border-border w-11 h-11 rounded-pill cursor-pointer flex items-center justify-center transition duration-200 z-10 shrink-0 shadow-sm hover:enabled:bg-primary-soft hover:enabled:scale-[1.04] active:enabled:scale-[0.96] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none motion-reduce:transition-none"
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
                <div className="variation-slider flex-1 overflow-hidden relative min-w-0" ref={sliderRef}>
                  <div className="variation-slider-track grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
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
                          className={`variation-card bg-surface rounded-lg overflow-hidden cursor-pointer transition duration-200 border flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                            selectedVariation === actualIndex ? "active border-primary shadow-md" : "border-border"
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
                          <div className="variation-card-image w-full h-[240px] flex items-center justify-center bg-surface-muted overflow-hidden p-4">
                            <img
                              src={variation.image || '/images/products/spac1.webp'}
                              alt={variation.name}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                // Fallback to default image if image fails to load
                                if (e.target.src !== '/images/products/spac1.webp') {
                                  e.target.src = '/images/products/spac1.webp';
                                }
                              }}
                            />
                          </div>
                          <div className="variation-card-details p-5 flex flex-col gap-4 bg-surface">
                            <h4 className="variation-card-title text-[length:var(--text-lg)] text-text m-0 font-semibold leading-[var(--leading-snug)] tracking-[-0.01em]">
                              {display(variation.name)}
                            </h4>
                            <div className="variation-specs flex flex-col gap-2">
                              <div className="variation-spec-item flex justify-between gap-2 items-baseline">
                                <span className="variation-spec-label text-[length:var(--text-sm)] text-text-muted font-normal">
                                  Frame Colour
                                </span>
                                <span className="variation-spec-value text-[length:var(--text-sm)] text-text font-medium text-right">
                                  {display(variation.frameColour)}
                                </span>
                              </div>
                              <div className="variation-spec-item flex justify-between gap-2 items-baseline">
                                <span className="variation-spec-label text-[length:var(--text-sm)] text-text-muted font-normal">
                                  Lense Colour
                                </span>
                                <span className="variation-spec-value text-[length:var(--text-sm)] text-text font-medium text-right">
                                  {display(variation.lenseColour)}
                                </span>
                              </div>
                            </div>
                            <div
                              className="quantity-selector-small w-full flex items-center justify-between gap-1 bg-surface border border-border-strong rounded-md p-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="qty-btn-small minus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Decrease quantity for ${variation.name}`}
                                disabled={getQuantity(variation.id) <= 1}
                                onClick={(e) =>
                                  handleQuantityDecrease(variation.id, e)
                                }
                              >
                                <span aria-hidden="true">&minus;</span>
                              </button>
                              <input
                                className="qty-number-small text-center font-semibold text-text bg-transparent text-[length:var(--text-md)] px-2 border-none w-full min-w-[48px] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 focus-visible:outline-none focus-visible:rounded-sm focus-visible:shadow-[var(--focus-ring)]"
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
                                className="qty-btn-small plus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
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
                              className={`add-to-cart-btn-small w-full min-h-[44px] px-6 py-3 rounded-md text-[length:var(--text-base)] font-semibold cursor-pointer border transition duration-200 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${addedIds[variation.id] ? "is-added bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active active:border-primary-active"}`}
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
                    className="slider-arrow right bg-surface text-primary border border-border w-11 h-11 rounded-pill cursor-pointer flex items-center justify-center transition duration-200 z-10 shrink-0 shadow-sm hover:enabled:bg-primary-soft hover:enabled:scale-[1.04] active:enabled:scale-[0.96] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none motion-reduce:transition-none"
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
            <div className="main-product-display grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-10 bg-transparent pt-4 px-0 pb-0 items-center">
              <div className="main-product-image w-full h-[320px] md:h-[400px] flex items-center justify-center bg-surface rounded-lg overflow-hidden p-6 shadow-lg">
                {(() => {
                  const mainImageSrc = currentProduct.image || '/images/products/spac1.webp';
                  if (brokenMainImageSrc === mainImageSrc) {
                    return (
                      <div
                        className="main-product-image-unavailable flex flex-col items-center justify-center gap-2 text-text-subtle"
                        role="img"
                        aria-label="Image unavailable"
                      >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="9" cy="9" r="1.5" />
                          <path d="m21 15-3.5-3.5L9 20" />
                          <line x1="3" y1="3" x2="21" y2="21" />
                        </svg>
                        <span className="text-[length:var(--text-sm)] font-medium tracking-[var(--tracking-label)] uppercase">Image unavailable</span>
                      </div>
                    );
                  }
                  return (
                    <img
                      src={mainImageSrc}
                      alt={currentProduct.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        // Fallback to default image if image fails to load; if the
                        // local placeholder fails too, show the "image unavailable"
                        // affordance instead of leaving blank space.
                        if (e.target.src !== '/images/products/spac1.webp' && e.target.dataset.fallbackApplied !== 'true') {
                          e.target.dataset.fallbackApplied = 'true';
                          e.target.src = '/images/products/spac1.webp';
                        } else {
                          setBrokenMainImageSrc(mainImageSrc);
                        }
                      }}
                    />
                  );
                })()}
              </div>
              <div className="main-product-info flex flex-col gap-6">
                <h2 className="product-title text-[length:var(--text-2xl)] text-text-on-primary m-0 font-semibold leading-[var(--leading-tight)] tracking-[-0.02em]">{display(currentProduct.name)}</h2>
                <div className="price-info flex flex-col gap-2">
                  <div className="price-item flex items-baseline gap-4">
                    <span className="price-label text-[length:var(--text-sm)] text-[rgba(255,255,255,0.7)] font-normal uppercase tracking-[var(--tracking-label)] min-w-[44px]">MRP</span>
                    <span className="price-value text-[length:var(--text-xl)] text-text-on-primary font-semibold">{display(currentProduct.mrp)}</span>
                  </div>
                  <div className="price-item flex items-baseline gap-4">
                    <span className="price-label text-[length:var(--text-sm)] text-[rgba(255,255,255,0.7)] font-normal uppercase tracking-[var(--tracking-label)] min-w-[44px]">WHP</span>
                    <span className="price-value text-[length:var(--text-lg)] text-accent font-semibold">{display(currentProduct.whp)}</span>
                  </div>
                </div>
                <div className="main-selector-action-row flex flex-wrap gap-4 items-center mt-2 sm:flex-nowrap">
                  <div className="quantity-selector-small w-full sm:w-auto flex-none flex items-center justify-between gap-1 bg-surface border border-border-strong rounded-md p-1">
                    <button
                      type="button"
                      className="qty-btn-small minus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Decrease quantity"
                      disabled={getQuantity(currentProduct.id) <= 1}
                      onClick={(e) =>
                        handleQuantityDecrease(currentProduct.id, e)
                      }
                    >
                      <span aria-hidden="true">&minus;</span>
                    </button>
                    <input
                      className="qty-number-small text-center font-semibold text-text bg-transparent text-[length:var(--text-md)] px-2 border-none w-full min-w-[48px] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0 focus-visible:outline-none focus-visible:rounded-sm focus-visible:shadow-[var(--focus-ring)]"
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
                      className="qty-btn-small plus bg-primary-soft rounded-sm border border-transparent cursor-pointer text-[length:var(--text-lg)] leading-none text-primary w-10 h-10 shrink-0 flex items-center justify-center transition duration-200 p-0 hover:enabled:bg-primary-soft-hover active:enabled:bg-primary active:enabled:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-40 disabled:cursor-not-allowed"
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
                    className={`add-to-cart-btn-small w-full sm:w-auto sm:flex-1 min-h-[44px] px-6 py-3 rounded-md text-[length:var(--text-base)] font-semibold cursor-pointer border transition duration-200 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${addedIds[currentProduct.id] ? "is-added bg-success border-success text-text-on-primary" : "bg-primary border-primary text-text-on-primary hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active active:border-primary-active"}`}
                    onClick={(e) => handleAddToCart(currentProduct, e)}
                  >
                    {addedIds[currentProduct.id] ? "Added ✓" : "Add to Cart"}
                  </button>
                </div>
              </div>
            </div>

            {/* Variation Thumbnails */}
            <div
              className="variation-thumbnails flex gap-4 justify-start flex-wrap"
              role="listbox"
              aria-label="Product variation thumbnails"
            >
              {productVariations.map((variation, index) => (
                <div
                  key={variation.id}
                  ref={(node) => {
                    thumbnailRefs.current[index] = node;
                  }}
                  className={`thumbnail w-[88px] h-[88px] rounded-md overflow-hidden cursor-pointer border transition duration-200 bg-surface flex items-center justify-center p-2 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.45)] motion-reduce:transition-none ${
                    selectedVariation === index ? "active border-accent shadow-[0_0_0_2px_var(--color-accent),var(--shadow-md)]" : "border-transparent"
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
                    className="w-full h-full object-contain"
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
            <div className="features-box-standalone bg-surface rounded-lg py-5 px-6 md:py-6 md:px-8 border border-border shadow-sm mt-6">
              <h3 className="features-title text-[length:var(--text-lg)] text-text mt-0 mb-6 mx-0 font-semibold tracking-[-0.01em]">Features</h3>
              <div className="features-grid grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-y-6 md:gap-x-10 relative">
                <div className="features-column flex flex-col gap-4 items-stretch">
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Brand</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.brand)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Type</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.type)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Gender</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.gender)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Shape</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.shape)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Size</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.size)}
                    </span>
                  </div>
                </div>
                <div className="features-column flex flex-col gap-4 items-stretch">
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Frame Colour</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.frameColour)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Frame Material</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.frameMaterial)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Lense Colour</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.lenseColour)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">Lense Material</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
                      {display(displayVariation.lenseMaterial)}
                    </span>
                  </div>
                  <div className="feature-item grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)] items-baseline gap-2 w-full">
                    <span className="feature-label font-normal text-text-muted text-[length:var(--text-base)] whitespace-nowrap col-start-1 text-left">QTY</span>
                    <span className="feature-separator text-border-strong font-normal text-[length:var(--text-base)] col-start-2">-</span>
                    <span className="feature-value text-text font-semibold text-[length:var(--text-base)] col-start-3 text-right break-words">
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
