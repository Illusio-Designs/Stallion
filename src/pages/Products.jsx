import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/ui/Skeleton';
import {
  getBrands,
  getFrameColors,
  getFrameMaterials,
  getFrameTypes,
  getGenders,
  getLensColors,
  getLensMaterials,
  getProducts,
  getShapes
} from '../services/apiService';
import { isLoggedIn } from '../services/authService';
import '../styles/components/filter-chips.css';
import '../styles/pages/Products.css';
import { productPath } from '../utils/dashboardRoutes';

const Products = ({ onPageChange }) => {
  // Check authentication on mount
  useEffect(() => {
    if (!isLoggedIn()) {
      // Get current URL to use as return URL
      const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/products';
      // Redirect to login with return URL
      if (typeof window !== 'undefined') {
        window.location.href = `/login?returnUrl=${encodeURIComponent(currentUrl)}`;
      }
    }
  }, []);

  // Get search query from URL and listen for real-time changes
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Get initial search from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const search = urlParams.get('search');
      if (search) {
        setSearchQuery(search);
      }
    }

    // Listen for real-time search changes
    const handleSearchChange = (event) => {
      const newSearch = event.detail.search || '';
      console.log('Search change event received:', newSearch);
      setSearchQuery(newSearch);
      setPage(1); // Reset to first page when search changes

      // Update URL
      const url = new URL(window.location);
      if (newSearch.trim()) {
        url.searchParams.set('search', newSearch.trim());
      } else {
        url.searchParams.delete('search');
      }
      window.history.replaceState({}, '', url);
    };

    // Listen for custom search change events
    window.addEventListener('searchChange', handleSearchChange);

    // Listen for URL changes (back/forward buttons)
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const search = urlParams.get('search') || '';
      setSearchQuery(search);
      setPage(1);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('searchChange', handleSearchChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [selectedBrands, setSelectedBrands] = useState([]); // Array of brand IDs
  const [selectedFrameMaterials, setSelectedFrameMaterials] = useState([]); // Array of frame_material_id
  const [selectedShapes, setSelectedShapes] = useState([]); // Array of shape_id
  const [selectedType, setSelectedType] = useState(null); // Single frame_type_id
  const [selectedGender, setSelectedGender] = useState([]); // Array of gender_id
  const [selectedLensColor, setSelectedLensColor] = useState(null); // Single lens_color_id
  const [selectedLensMaterial, setSelectedLensMaterial] = useState([]); // Array of lens_material_id
  const [selectedFrameColor, setSelectedFrameColor] = useState(null); // Single frame_color_id
  const [selectedColorCode, setSelectedColorCode] = useState(null); // Single color_code_id

  // Products display
  const [products, setProducts] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 20; // Products per page (server-side pagination)

  // Filter options from API
  const [brandsData, setBrandsData] = useState([]);
  const [gendersData, setGendersData] = useState([]);
  const [shapesData, setShapesData] = useState([]);
  const [lensColorsData, setLensColorsData] = useState([]);
  const [frameColorsData, setFrameColorsData] = useState([]);
  const [lensMaterialsData, setLensMaterialsData] = useState([]);
  const [frameMaterialsData, setFrameMaterialsData] = useState([]);
  const [frameTypesData, setFrameTypesData] = useState([]);

  // Dropdown states for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    brands: true,
    frameMaterial: false,
    shape: false,
    type: false,
    gender: false,
    lensColor: false,
    lensMaterial: false,
    frameColor: false
  });

  // Static data for filters
  const types = ['Full Frame', 'Half Frame', 'Rimless'];

  // Color mapping helper
  const getColorHex = (colorName) => {
    const colorMap = {
      'Black': '#000000',
      'Dark Blue': '#1E3A8A',
      'Light Blue': '#60A5FA',
      'Green': '#10B981',
      'Yellow': '#FBBF24',
      'Pink': '#EC4899',
      'Grey': '#9CA3AF',
      'Gray': '#9CA3AF',
      'White': '#FFFFFF'
    };
    return colorMap[colorName] || '#CCCCCC';
  };


  // Lazy filter loaders: each filter's options are fetched only the first time
  // its sidebar section is expanded - not all at once on page load.
  const filterLoaded = useRef({});
  const filterLoaders = {
    brands: [getBrands, setBrandsData],
    frameMaterial: [getFrameMaterials, setFrameMaterialsData],
    shape: [getShapes, setShapesData],
    type: [getFrameTypes, setFrameTypesData],
    gender: [getGenders, setGendersData],
    lensColor: [getLensColors, setLensColorsData],
    lensMaterial: [getLensMaterials, setLensMaterialsData],
    frameColor: [getFrameColors, setFrameColorsData],
  };
  const loadFilterData = async (section) => {
    const entry = filterLoaders[section];
    if (!entry || filterLoaded.current[section]) return;
    filterLoaded.current[section] = true;
    try {
      const data = await entry[0]();
      entry[1](data || []);
    } catch (err) {
      filterLoaded.current[section] = false; // allow retry
      console.error(`Failed to load ${section} filter options:`, err);
    }
  };

  // Load only the section(s) expanded by default (brands) on mount.
  useEffect(() => {
    Object.keys(expandedSections).forEach((s) => {
      if (expandedSections[s]) loadFilterData(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build filter object for API - Only include fields with actual values
  const buildFilters = useCallback(() => {
    const filters = {};

    // Only include filter fields that have values (don't include null/empty fields)
    // gender_id
    if (selectedGender.length > 0) {
      filters.gender_id = selectedGender.length === 1 ? selectedGender[0] : selectedGender;
    }

    // color_code_id
    if (selectedColorCode !== null && selectedColorCode !== undefined) {
      filters.color_code_id = selectedColorCode;
    }

    // shape_id
    if (selectedShapes.length > 0) {
      filters.shape_id = selectedShapes.length === 1 ? selectedShapes[0] : selectedShapes;
    }

    // lens_color_id
    if (selectedLensColor !== null && selectedLensColor !== undefined) {
      filters.lens_color_id = selectedLensColor;
    }

    // frame_color_id
    if (selectedFrameColor !== null && selectedFrameColor !== undefined) {
      filters.frame_color_id = selectedFrameColor;
    }

    // frame_type_id
    if (selectedType !== null && selectedType !== undefined) {
      filters.frame_type_id = selectedType;
    }

    // lens_material_id
    if (selectedLensMaterial.length > 0) {
      filters.lens_material_id = selectedLensMaterial.length === 1 ? selectedLensMaterial[0] : selectedLensMaterial;
    }

    // frame_material_id
    if (selectedFrameMaterials.length > 0) {
      filters.frame_material_id = selectedFrameMaterials.length === 1 ? selectedFrameMaterials[0] : selectedFrameMaterials;
    }

    // brand_id (optional, but include if selected)
    if (selectedBrands.length > 0) {
      filters.brand_id = selectedBrands.length === 1 ? selectedBrands[0] : selectedBrands;
    }

    // Always filter to show only active products in public page (hide draft products)
    filters.status = 'active';

    // Always include price filter with full range (backend requires it)
    filters.price = {
      min: 0,
      max: 10000
    };

    return filters;
  }, [
    selectedGender,
    selectedColorCode,
    selectedShapes,
    selectedLensColor,
    selectedFrameColor,
    selectedType,
    selectedLensMaterial,
    selectedFrameMaterials,
    selectedBrands
  ]);

  // Stable string key for the active filters so the fetch effect only re-runs
  // when the filter values actually change (not on every render).
  const filtersKey = useMemo(() => JSON.stringify(buildFilters()), [buildFilters]);

  // Build the list of active-filter chips (label + how to remove it).
  const activeFilterChips = useMemo(() => {
    const chips = [];
    const labelFor = (data, id, idKeys, labelKeys) => {
      const item = (data || []).find(d => idKeys.some(k => String(d[k]) === String(id)));
      return item ? (labelKeys.map(k => item[k]).find(Boolean) || id) : id;
    };
    // Multi-select filters
    const multi = [
      { ids: selectedGender, data: gendersData, idKeys: ['gender_id', 'id'], labelKeys: ['gender_name', 'name'], setter: setSelectedGender, prefix: 'gender' },
      { ids: selectedShapes, data: shapesData, idKeys: ['shape_id', 'id'], labelKeys: ['shape_name', 'name'], setter: setSelectedShapes, prefix: 'shape' },
      { ids: selectedBrands, data: brandsData, idKeys: ['brand_id', 'id'], labelKeys: ['brand_name', 'name'], setter: setSelectedBrands, prefix: 'brand' },
      { ids: selectedLensMaterial, data: lensMaterialsData, idKeys: ['lens_material_id', 'id'], labelKeys: ['lens_material', 'name'], setter: setSelectedLensMaterial, prefix: 'lensmat' },
      { ids: selectedFrameMaterials, data: frameMaterialsData, idKeys: ['frame_material_id', 'id'], labelKeys: ['frame_material', 'name'], setter: setSelectedFrameMaterials, prefix: 'framemat' },
    ];
    multi.forEach(({ ids, data, idKeys, labelKeys, setter, prefix }) => {
      (ids || []).forEach(id => {
        chips.push({
          key: `${prefix}-${id}`,
          label: labelFor(data, id, idKeys, labelKeys),
          remove: () => setter(prev => prev.filter(x => x !== id)),
        });
      });
    });
    // Single-select filters
    const single = [
      { id: selectedType, data: frameTypesData, idKeys: ['frame_type_id', 'id'], labelKeys: ['frame_type', 'name'], setter: setSelectedType, prefix: 'frametype' },
      { id: selectedLensColor, data: lensColorsData, idKeys: ['lens_color_id', 'id'], labelKeys: ['lens_color', 'name'], setter: setSelectedLensColor, prefix: 'lenscolor' },
      { id: selectedFrameColor, data: frameColorsData, idKeys: ['frame_color_id', 'id'], labelKeys: ['frame_color', 'name'], setter: setSelectedFrameColor, prefix: 'framecolor' },
    ];
    single.forEach(({ id, data, idKeys, labelKeys, setter, prefix }) => {
      if (id != null) {
        chips.push({
          key: `${prefix}-${id}`,
          label: labelFor(data, id, idKeys, labelKeys),
          remove: () => setter(null),
        });
      }
    });
    return chips;
  }, [selectedGender, selectedShapes, selectedBrands, selectedLensMaterial, selectedFrameMaterials, selectedType, selectedLensColor, selectedFrameColor, gendersData, shapesData, brandsData, lensMaterialsData, frameMaterialsData, frameTypesData, lensColorsData, frameColorsData]);

  // Fetch the current page of products from the server (20/page).
  // Attribute filters are sent to the backend instead of fetching the whole
  // catalogue and filtering client-side.
  useEffect(() => {
    let cancelled = false;

    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const filters = buildFilters();
        const isActive = (p) => (p.status || '').toLowerCase().trim() === 'active';

        if (searchQuery && searchQuery.trim()) {
          // The products API has no text-search parameter, so model_no search is
          // resolved client-side. This bounded loop only runs during an explicit
          // search (not on normal browsing), and respects the active filters.
          const q = searchQuery.trim().toLowerCase();
          let collected = [];
          let p = 1;
          let more = true;
          while (more && p <= 50) {
            const result = await getProducts(p, 100, filters);
            const arr = result.data || [];
            collected = collected.concat(
              arr.filter((pr) => isActive(pr) && (pr.model_no || '').toLowerCase().includes(q))
            );
            more = arr.length === 100;
            p += 1;
          }
          if (cancelled) return;
          const start = (page - 1) * limit;
          setProducts(collected.slice(start, start + limit));
          setTotalResults(collected.length);
          setTotalPages(Math.max(1, Math.ceil(collected.length / limit)));
        } else {
          // Normal browse / attribute filtering: true server-side pagination.
          const result = await getProducts(page, limit, filters);
          const arr = result.data || [];
          if (cancelled) return;
          const activeArr = arr.filter(isActive);
          setProducts(activeArr);
          if (result.pagination?.totalPages != null) {
            setTotalPages(Math.max(1, result.pagination.totalPages));
            setTotalResults(result.pagination.total ?? activeArr.length);
          } else {
            // Fallback when API omits pagination metadata.
            setTotalPages(arr.length === limit ? page + 1 : page);
            setTotalResults(activeArr.length);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching products:', err);
        setError(err.message || 'Failed to fetch products');
        setProducts([]);
        setTotalResults(0);
        setTotalPages(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPage();
    return () => { cancelled = true; };
    // buildFilters is intentionally excluded; filtersKey captures its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, filtersKey, limit]);

  const handleReset = () => {
    setSelectedBrands([]);
    setSelectedFrameMaterials([]);
    setSelectedShapes([]);
    setSelectedType(null);
    setSelectedGender([]);
    setSelectedLensColor(null);
    setSelectedLensMaterial([]);
    setSelectedFrameColor(null);
    setSelectedColorCode(null);
    setPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    selectedGender,
    selectedColorCode,
    selectedShapes,
    selectedLensColor,
    selectedFrameColor,
    selectedType,
    selectedLensMaterial,
    selectedFrameMaterials,
    selectedBrands
  ]);

  const toggleSelection = (item, selectedItems, setSelectedItems) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      if (next[section]) loadFilterData(section); // fetch options on first expand
      return next;
    });
  };

  // Allow Enter/Space to activate elements that are divs-with-onClick.
  const onKeyActivate = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const handleViewMore = (productId, modelNo) => {
    // Clean product route: /product/<model_no>
    if (typeof window !== 'undefined') {
      window.location.href = productPath(modelNo);
    }
  };

  // Helper function to get product image
  const getProductImage = (product) => {
    if (!product) return '/images/products/spac1.webp';

    // Extract filename from path and construct URL
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

    // Parse image_urls - handle JSON string format like "[\"/uploads/products/spac2-1766058948930.webp\"]"
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

    // Handle image_urls (can be array or JSON string)
    const imageUrls = parseImageUrls(product.image_urls);
    if (imageUrls && imageUrls.length > 0) {
      const firstImage = imageUrls[0];
      if (firstImage) {
        const filename = extractFilename(firstImage);
        if (filename) {
          return `https://stallion.nishree.com/uploads/products/${filename}`;
        }
      }
    }

    // Handle single image_url string
    if (product.image_url) {
      const filename = extractFilename(product.image_url);
      if (filename) {
        return `https://stallion.nishree.com/uploads/products/${filename}`;
      }
    }

    // Default fallback
    return '/images/products/spac1.webp';
  };

  const sectionHeaderClass = "filter-section-header flex justify-between items-center cursor-pointer py-4 select-none group";
  const sectionTitleClass = "text-[length:var(--text-base)] font-semibold text-text transition-colors duration-[120ms] group-hover:text-primary";
  const chevronBaseClass = "chevron flex items-center justify-center text-text-subtle transition-[transform,color] duration-300 group-hover:text-text-muted";
  const checkboxLabelClass = "checkbox-label flex items-center gap-3 text-text-muted mb-1 p-2 -mx-2 rounded-sm cursor-pointer text-[length:var(--text-base)] min-h-[40px] box-border transition-[background,color] duration-[120ms] hover:text-text hover:bg-surface-muted";
  const radioLabelClass = "radio-label flex items-center gap-3 text-text-muted mb-1 p-2 -mx-2 rounded-sm cursor-pointer text-[length:var(--text-base)] min-h-[40px] box-border transition-[background,color] duration-[120ms] hover:text-text hover:bg-surface-muted";

  const FilterContent = () => (
    <>
      <div className="filter-header flex justify-between items-center mb-5">
        <h2 className="text-[length:var(--text-lg)] font-semibold tracking-[-0.01em] text-text m-0">Filter</h2>
        <button type="button" className="reset-button bg-transparent text-primary border-none py-1 px-2 -m-1 -mx-2 rounded-sm text-[length:var(--text-sm)] font-semibold cursor-pointer transition-[background,color] duration-[120ms] hover:bg-primary-soft hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:bg-primary-soft-hover" onClick={handleReset}>Reset</button>
      </div>

      {/* Brands Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.brands} onClick={() => toggleSection('brands')} onKeyDown={onKeyActivate(() => toggleSection('brands'))}>
          <h3 className={sectionTitleClass}>Brands</h3>
          <span className={`${chevronBaseClass} ${expandedSections.brands ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.brands && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {brandsData.map(brand => {
              const brandId = brand.brand_id || brand.id;
              const brandName = brand.brand_name || brand.name || '';
              return (
                <label key={brandId} className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(brandId)}
                    onChange={() => toggleSelection(brandId, selectedBrands, setSelectedBrands)}
                  />
                  <span>{brandName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Frame Material Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.frameMaterial} onClick={() => toggleSection('frameMaterial')} onKeyDown={onKeyActivate(() => toggleSection('frameMaterial'))}>
          <h3 className={sectionTitleClass}>Frame Material</h3>
          <span className={`${chevronBaseClass} ${expandedSections.frameMaterial ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.frameMaterial && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {frameMaterialsData.map(material => {
              const materialId = material.frame_material_id || material.id;
              const materialName = material.frame_material || material.frame_material_name || material.name || '';
              return (
                <label key={materialId} className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={selectedFrameMaterials.includes(materialId)}
                    onChange={() => toggleSelection(materialId, selectedFrameMaterials, setSelectedFrameMaterials)}
                  />
                  <span>{materialName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Shape Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.shape} onClick={() => toggleSection('shape')} onKeyDown={onKeyActivate(() => toggleSection('shape'))}>
          <h3 className={sectionTitleClass}>Shape</h3>
          <span className={`${chevronBaseClass} ${expandedSections.shape ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.shape && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {shapesData.map(shape => {
              const shapeId = shape.shape_id || shape.id;
              const shapeName = shape.shape_name || shape.name || '';
              return (
                <label key={shapeId} className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={selectedShapes.includes(shapeId)}
                    onChange={() => toggleSelection(shapeId, selectedShapes, setSelectedShapes)}
                  />
                  <span>{shapeName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Frame Type Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.type} onClick={() => toggleSection('type')} onKeyDown={onKeyActivate(() => toggleSection('type'))}>
          <h3 className={sectionTitleClass}>Frame Type</h3>
          <span className={`${chevronBaseClass} ${expandedSections.type ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.type && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {frameTypesData.map(frameType => {
              const typeId = frameType.frame_type_id || frameType.id;
              const typeName = frameType.frame_type || frameType.frame_type_name || frameType.name || '';
              return (
                <label key={typeId} className={radioLabelClass}>
                  <input
                    type="radio"
                    name="type"
                    checked={selectedType === typeId}
                    onChange={() => setSelectedType(selectedType === typeId ? null : typeId)}
                  />
                  <span>{typeName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Gender Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.gender} onClick={() => toggleSection('gender')} onKeyDown={onKeyActivate(() => toggleSection('gender'))}>
          <h3 className={sectionTitleClass}>Gender</h3>
          <span className={`${chevronBaseClass} ${expandedSections.gender ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.gender && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {gendersData.map(gender => {
              const genderId = gender.gender_id || gender.id;
              const genderName = gender.gender_name || gender.name || '';
              return (
                <label key={genderId} className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={selectedGender.includes(genderId)}
                    onChange={() => toggleSelection(genderId, selectedGender, setSelectedGender)}
                  />
                  <span>{genderName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Lens Colour Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.lensColor} onClick={() => toggleSection('lensColor')} onKeyDown={onKeyActivate(() => toggleSection('lensColor'))}>
          <h3 className={sectionTitleClass}>Lens Colour</h3>
          <span className={`${chevronBaseClass} ${expandedSections.lensColor ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.lensColor && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            <div className="color-swatches flex flex-wrap gap-3 py-1">
              {lensColorsData.map(lensColor => {
                const colorId = lensColor.lens_color_id || lensColor.id;
                const colorName = lensColor.lens_color || lensColor.name || '';
                const colorHex = lensColor.hex || lensColor.color_hex || getColorHex(colorName);
                return (
                  <div
                    key={colorId}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedLensColor === colorId}
                    aria-label={colorName}
                    className={`color-swatch w-7 h-7 rounded-pill cursor-pointer border border-border-strong shadow-xs transition-[transform,box-shadow] duration-[120ms] hover:scale-110 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${selectedLensColor === colorId ? 'active' : ''}`}
                    style={{ backgroundColor: colorHex }}
                    onClick={() => setSelectedLensColor(selectedLensColor === colorId ? null : colorId)}
                    onKeyDown={onKeyActivate(() => setSelectedLensColor(selectedLensColor === colorId ? null : colorId))}
                    title={colorName}
                  ></div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lens Material Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.lensMaterial} onClick={() => toggleSection('lensMaterial')} onKeyDown={onKeyActivate(() => toggleSection('lensMaterial'))}>
          <h3 className={sectionTitleClass}>Lens Material</h3>
          <span className={`${chevronBaseClass} ${expandedSections.lensMaterial ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.lensMaterial && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            {lensMaterialsData.map(material => {
              const materialId = material.lens_material_id || material.id;
              const materialName = material.lens_material || material.lens_material_name || material.name || '';
              return (
                <label key={materialId} className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    checked={selectedLensMaterial.includes(materialId)}
                    onChange={() => toggleSelection(materialId, selectedLensMaterial, setSelectedLensMaterial)}
                  />
                  <span>{materialName}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Frame Colour Filter */}
      <div className="filter-section border-b border-border last:border-b-0">
        <div className={sectionHeaderClass} role="button" tabIndex={0} aria-expanded={expandedSections.frameColor} onClick={() => toggleSection('frameColor')} onKeyDown={onKeyActivate(() => toggleSection('frameColor'))}>
          <h3 className={sectionTitleClass}>Frame Colour</h3>
          <span className={`${chevronBaseClass} ${expandedSections.frameColor ? 'expanded rotate-180 !text-primary' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {expandedSections.frameColor && (
          <div className="filter-section-content mt-2 pb-2 motion-reduce:animate-none">
            <div className="color-swatches flex flex-wrap gap-3 py-1">
              {frameColorsData.map(frameColor => {
                const colorId = frameColor.frame_color_id || frameColor.id;
                const colorName = frameColor.frame_color || frameColor.name || '';
                const colorHex = frameColor.hex || frameColor.color_hex || getColorHex(colorName);
                return (
                  <div
                    key={colorId}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedFrameColor === colorId}
                    aria-label={colorName}
                    className={`color-swatch w-7 h-7 rounded-pill cursor-pointer border border-border-strong shadow-xs transition-[transform,box-shadow] duration-[120ms] hover:scale-110 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${selectedFrameColor === colorId ? 'active' : ''}`}
                    style={{ backgroundColor: colorHex }}
                    onClick={() => setSelectedFrameColor(selectedFrameColor === colorId ? null : colorId)}
                    onKeyDown={onKeyActivate(() => setSelectedFrameColor(selectedFrameColor === colorId ? null : colorId))}
                    title={colorName}
                  ></div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="products-page bg-bg mt-0 py-5 px-3 sm:py-6 sm:px-4 md:py-10 md:px-[5%]">
      <div className="products-container block md:flex md:items-start gap-6 lg:gap-8 max-w-[1440px] mx-auto pt-0">
        {/* Desktop Filter Sidebar (kept for larger viewports) */}
        <aside className="filter-sidebar hidden md:block md:w-[280px] md:flex-[0_0_280px] lg:w-[300px] lg:flex-[0_0_300px] bg-surface p-6 overflow-y-auto overflow-x-hidden border border-border rounded-lg shadow-sm max-h-[calc(100vh-64px-var(--header-height))] sticky top-[calc(var(--header-height)+8px)] [scrollbar-width:thin]">
          <FilterContent />
        </aside>

        {/* Mobile filter toggle - visible via CSS on small screens */}
        <button type="button" className="filter-toggle-btn inline-flex md:!hidden items-center gap-2 fixed left-1/2 -translate-x-1/2 bottom-6 bg-primary text-text-on-primary min-h-[48px] px-5 rounded-pill z-[1200] shadow-lg border-none cursor-pointer text-[length:var(--text-base)] font-semibold transition-colors duration-[120ms] hover:bg-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring),var(--shadow-lg)] active:bg-primary-active" onClick={() => setMobileFilterOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
        </button>

        {/* Mobile filter modal — portaled to <body> so position:fixed centers on
            the viewport (not a transformed ancestor) regardless of page scroll. */}
        {mobileFilterOpen && typeof document !== 'undefined' && createPortal(
          <div className="mobile-filter-modal open fixed inset-0 bg-[rgba(26,27,35,0.55)] backdrop-blur-[2px] z-[1500] flex items-center justify-center p-4" onClick={() => setMobileFilterOpen(false)} role="dialog" aria-modal="true" aria-label="Product filters">
            <div className="mobile-filter-modal__panel w-[min(520px,100%)]" onClick={(e) => e.stopPropagation()}>
              <aside className="filter-sidebar block w-full max-h-[calc(100vh-64px)] relative top-auto left-auto bg-surface rounded-xl p-6 shadow-xl overflow-y-auto border border-border [scrollbar-width:thin]">
                <div className="mobile-filter-modal__close-row flex justify-end mb-2">
                  <button type="button" className="mobile-filter-close inline-flex items-center justify-center w-10 h-10 border-none rounded-md bg-surface-muted text-text-muted text-[length:var(--text-xl)] leading-none cursor-pointer transition-[background,color] duration-[120ms] hover:bg-grey-200 hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]" onClick={() => setMobileFilterOpen(false)} aria-label="Close filters">
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <FilterContent />
              </aside>
            </div>
          </div>,
          document.body
        )}

        {/* Products Grid */}
        <main className="products-main flex-1 min-w-0 bg-transparent px-0 pt-0 pb-28 md:pb-0 min-h-[calc(100vh-var(--header-height))]">
          <div className="products-header flex justify-between items-center gap-4 mb-6 flex-wrap">
            <h2 className="text-[length:var(--text-lg)] sm:text-[length:var(--text-xl)] font-semibold tracking-[-0.01em] leading-[1.2] text-text m-0">
              {loading ? '' : searchQuery ?
                `${totalResults} results for "${searchQuery}"` :
                'Products'
              }
            </h2>
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn inline-flex items-center justify-center min-h-[40px] bg-surface text-text border border-border-strong py-2 px-4 rounded-md cursor-pointer text-[length:var(--text-base)] font-medium transition-[background,border-color] duration-[120ms] hover:bg-surface-muted hover:border-grey-400 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:bg-grey-200"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                  // Update URL to remove search parameter
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location);
                    url.searchParams.delete('search');
                    window.history.replaceState({}, '', url);
                  }
                }}
              >
                Clear Search
              </button>
            )}
          </div>

          {activeFilterChips.length > 0 && (
            <div className="active-filters flex flex-wrap items-center gap-2 mb-5">
              <span className="active-filters__label text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle mr-1">Filters:</span>
              {activeFilterChips.map(chip => (
                <button key={chip.key} type="button" className="filter-chip group inline-flex items-center gap-2 min-h-[32px] py-1 pr-2 pl-3 border border-border-strong rounded-pill bg-surface text-primary text-[length:var(--text-sm)] font-medium cursor-pointer transition-[background,border-color,color] duration-[120ms] hover:bg-primary-soft hover:border-primary focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[var(--focus-ring)] active:bg-primary-soft-hover" onClick={chip.remove} aria-label={`Remove filter ${chip.label}`} title={`Remove ${chip.label}`}>
                  <span className="filter-chip__label leading-none">{chip.label}</span>
                  <span className="filter-chip__x inline-flex items-center justify-center w-[18px] h-[18px] rounded-pill text-[length:var(--text-md)] leading-none text-text-subtle transition-[background,color] duration-[120ms] group-hover:bg-primary-soft-hover group-hover:text-primary" aria-hidden="true">&times;</span>
                </button>
              ))}
              <button type="button" className="filter-chip-clear inline-flex items-center min-h-[32px] py-1 px-3 border-none bg-transparent text-error text-[length:var(--text-sm)] font-semibold cursor-pointer rounded-sm transition-[background] duration-[120ms] hover:bg-error-soft focus-visible:outline-none focus-visible:shadow-[var(--focus-ring-error)] active:bg-error-soft active:brightness-[0.97]" onClick={handleReset}>Clear all</button>
            </div>
          )}

          {error ? (
            <div className="ui-state ui-state--error products-state bg-surface border border-border rounded-lg shadow-sm">
              <span className="ui-state__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <p className="ui-state__title">Something went wrong</p>
              <p className="ui-state__desc">{error}</p>
              <div className="ui-state__actions">
                <button type="button" className="ui-btn ui-btn--primary ui-btn--md" onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}>
                  <span className="ui-btn__label">Try again</span>
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="products-grid-container grid grid-cols-2 lg:grid-cols-3 gap-2 min-[381px]:gap-3 sm:gap-6 w-full items-stretch pb-16 md:pb-0" aria-busy="true" aria-live="polite">
              {Array.from({ length: limit }).map((_, i) => (
                <div key={`product-skeleton-${i}`} className="product-skeleton flex flex-col box-border bg-surface border border-border rounded-lg p-3 min-[381px]:p-4 sm:p-5 shadow-sm">
                  <Skeleton width="100%" height={180} radius={12} />
                  <Skeleton width="70%" height={16} className="product-skeleton__line" />
                  <Skeleton width="40%" height={14} className="product-skeleton__line" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="products-grid-container grid grid-cols-2 lg:grid-cols-3 gap-2 min-[381px]:gap-3 sm:gap-6 w-full items-stretch pb-16 md:pb-0">
              {products.map(product => {
                const productId = product.product_id || product.id;
                const productName = product.model_no || product.name || 'Product';
                const productImage = getProductImage(product);

                return (
                  <ProductCard
                    key={productId}
                    productId={productId}
                    productName={productName}
                    productImage={productImage}
                    whp={product.whp}
                    mrp={product.mrp}
                    onViewMore={handleViewMore}
                  />
                );
              })}
            </div>
          ) : (
            <div className="ui-state ui-state--empty products-state bg-surface border border-border rounded-lg shadow-sm">
              <span className="ui-state__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <p className="ui-state__title">
                {searchQuery ? `No frames match "${searchQuery}"` : 'No frames match'}
              </p>
              <p className="ui-state__desc">
                {searchQuery
                  ? 'Try a different search term or clear your filters to see more frames.'
                  : 'Try removing some filters to see more frames.'}
              </p>
              {(activeFilterChips.length > 0 || searchQuery) && (
                <div className="ui-state__actions">
                  <button type="button" className="ui-btn ui-btn--secondary ui-btn--md" onClick={handleReset}>
                    <span className="ui-btn__label">Clear filters</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && products.length > 0 && totalPages > 1 && (
            <nav className="products-pagination flex justify-center items-center gap-4 mt-10 py-5" aria-label="Products pagination">
              <button
                type="button"
                className="pagination-btn inline-flex items-center justify-center min-h-[40px] bg-surface text-primary border border-border-strong py-2 px-5 rounded-md text-[length:var(--text-base)] font-medium cursor-pointer transition-[background,border-color,color] duration-[120ms] hover:not-disabled:bg-primary-soft hover:not-disabled:border-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:not-disabled:bg-primary-soft-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:text-text-subtle"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <div className="pagination-info text-text-muted text-[length:var(--text-base)] font-medium min-w-[120px] text-center" aria-live="polite">
                Page {page} of {totalPages}
              </div>
              <button
                type="button"
                className="pagination-btn inline-flex items-center justify-center min-h-[40px] bg-surface text-primary border border-border-strong py-2 px-5 rounded-md text-[length:var(--text-base)] font-medium cursor-pointer transition-[background,border-color,color] duration-[120ms] hover:not-disabled:bg-primary-soft hover:not-disabled:border-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:not-disabled:bg-primary-soft-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:text-text-subtle"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
};

export default Products;
