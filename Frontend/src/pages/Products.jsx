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
import '../styles/redesign-p-shop.css';
import { FiChevronRight, FiSearch, FiSliders, FiX } from '../components/icons/hugeicons';
import { productPath } from '../utils/dashboardRoutes';
import { encodeUploadName } from '../utils/imageUrl';

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
    brands: false,
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
    brands: [() => getBrands({ activeOnly: true }), setBrandsData],
    frameMaterial: [() => getFrameMaterials({ activeOnly: true }), setFrameMaterialsData],
    shape: [() => getShapes({ activeOnly: true }), setShapesData],
    type: [() => getFrameTypes({ activeOnly: true }), setFrameTypesData],
    gender: [() => getGenders({ activeOnly: true }), setGendersData],
    lensColor: [() => getLensColors({ activeOnly: true }), setLensColorsData],
    lensMaterial: [() => getLensMaterials({ activeOnly: true }), setLensMaterialsData],
    frameColor: [() => getFrameColors({ activeOnly: true }), setFrameColorsData],
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

  // Groups start collapsed; only the shape list loads on mount, for the quick
  // shape chips. Other lists load the first time their group opens.
  useEffect(() => {
    loadFilterData('shape');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build filter object for API - Only include fields with actual values
  const buildFilters = useCallback(() => {
    // The shop shows only frames that are in stock (also when searching).
    const filters = { in_stock: true };

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

  // Debounce the search text (~300 ms) so typing doesn't fire a request per key.
  // Clearing the search applies immediately.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (!searchQuery) { setDebouncedSearch(''); return undefined; }
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

        {
          // Server-side pagination + search (backend `search` param; debounced above).
          const term = (debouncedSearch || '').trim();
          if (term) filters.search = term;
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
  }, [page, debouncedSearch, filtersKey, limit]);

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
  // Drives the slide-in animation of the mobile filter drawer (flip on after mount).
  const [drawerIn, setDrawerIn] = useState(false);
  useEffect(() => {
    if (!mobileFilterOpen) { setDrawerIn(false); return; }
    const t = setTimeout(() => setDrawerIn(true), 10);
    return () => clearTimeout(t);
  }, [mobileFilterOpen]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileFilterOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileFilterOpen]);

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

    // Same base the Media gallery / product pages use, with the filename
    // percent-encoded (product file names contain spaces).
    const imageBase = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://api.stallioneyewear.in').replace(/\/+$/, '');

    // Handle image_urls (can be array or JSON string)
    const imageUrls = parseImageUrls(product.image_urls);
    if (imageUrls && imageUrls.length > 0) {
      const firstImage = imageUrls[0];
      if (firstImage) {
        const filename = extractFilename(firstImage);
        if (filename) {
          return `${imageBase}/uploads/products/${encodeUploadName(filename)}`;
        }
      }
    }

    // Handle single image_url string
    if (product.image_url) {
      const filename = extractFilename(product.image_url);
      if (filename) {
        return `${imageBase}/uploads/products/${encodeUploadName(filename)}`;
      }
    }

    // Default fallback
    return '/images/products/spac1.webp';
  };

  // Filter groups, in the same order and with the same ids as before.
  const filterGroups = [
    { key: 'brands', title: 'Brand', kind: 'check', data: brandsData, idKeys: ['brand_id', 'id'], nameKeys: ['brand_name', 'name'], selected: selectedBrands, set: setSelectedBrands },
    { key: 'frameMaterial', title: 'Frame material', kind: 'check', data: frameMaterialsData, idKeys: ['frame_material_id', 'id'], nameKeys: ['frame_material', 'frame_material_name', 'name'], selected: selectedFrameMaterials, set: setSelectedFrameMaterials },
    { key: 'shape', title: 'Shape', kind: 'check', data: shapesData, idKeys: ['shape_id', 'id'], nameKeys: ['shape_name', 'name'], selected: selectedShapes, set: setSelectedShapes },
    { key: 'type', title: 'Frame type', kind: 'radio', data: frameTypesData, idKeys: ['frame_type_id', 'id'], nameKeys: ['frame_type', 'frame_type_name', 'name'], selected: selectedType, set: setSelectedType },
    { key: 'gender', title: 'Gender', kind: 'check', data: gendersData, idKeys: ['gender_id', 'id'], nameKeys: ['gender_name', 'name'], selected: selectedGender, set: setSelectedGender },
    { key: 'lensColor', title: 'Lens colour', kind: 'swatch', data: lensColorsData, idKeys: ['lens_color_id', 'id'], nameKeys: ['lens_color', 'name'], selected: selectedLensColor, set: setSelectedLensColor },
    { key: 'lensMaterial', title: 'Lens material', kind: 'check', data: lensMaterialsData, idKeys: ['lens_material_id', 'id'], nameKeys: ['lens_material', 'lens_material_name', 'name'], selected: selectedLensMaterial, set: setSelectedLensMaterial },
    { key: 'frameColor', title: 'Frame colour', kind: 'swatch', data: frameColorsData, idKeys: ['frame_color_id', 'id'], nameKeys: ['frame_color', 'name'], selected: selectedFrameColor, set: setSelectedFrameColor },
  ];
  const firstOf = (obj, keys) => keys.map(k => obj[k]).find(v => v !== undefined && v !== null && v !== '');

  const renderFilters = (idPrefix) => (
    <>
      {filterGroups.map(group => {
        const open = expandedSections[group.key];
        const count = Array.isArray(group.selected) ? group.selected.length : (group.selected != null ? 1 : 0);
        const panelId = `${idPrefix}-${group.key}`;
        return (
          <div key={group.key} className="shop-group">
            <button
              type="button"
              className="shop-group__head"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggleSection(group.key)}
            >
              <span className="shop-group__title">{group.title}</span>
              {count > 0 && <span className="shop-group__count">{count}</span>}
              <span className={`shop-group__chev${open ? ' is-open' : ''}`} aria-hidden="true"><FiChevronRight size={16} /></span>
            </button>
            {open && (
              <div id={panelId} className={`shop-group__body${group.kind === 'swatch' ? ' shop-group__body--swatch' : ''}`}>
                {group.data.length === 0 && <p className="shop-group__empty">Loading…</p>}
                {group.data.map(item => {
                  const id = firstOf(item, group.idKeys);
                  const name = firstOf(item, group.nameKeys) || '';
                  if (group.kind === 'check') {
                    return (
                      <label key={id} className="shop-opt">
                        <input type="checkbox" checked={group.selected.includes(id)} onChange={() => toggleSelection(id, group.selected, group.set)} />
                        <span>{name}</span>
                      </label>
                    );
                  }
                  if (group.kind === 'radio') {
                    return (
                      <label key={id} className="shop-opt">
                        <input type="radio" name={`${idPrefix}-type`} checked={group.selected === id} onChange={() => group.set(group.selected === id ? null : id)} />
                        <span>{name}</span>
                      </label>
                    );
                  }
                  const hex = item.hex || item.color_hex || getColorHex(name);
                  const on = group.selected === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      aria-label={name}
                      title={name}
                      className={`shop-swatch${on ? ' is-on' : ''}`}
                      onClick={() => group.set(on ? null : id)}
                    >
                      <span style={{ backgroundColor: hex }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  // Quick shape chips use the same shape filter as the Refine panel; a chip is
  // shown only when that shape exists in the shape list.
  const quickShapes = ['Square', 'Round', 'Aviator']
    .map(label => {
      const item = shapesData.find(s => String(firstOf(s, ['shape_name', 'name']) || '').toLowerCase().includes(label.toLowerCase()));
      return item ? { label, id: firstOf(item, ['shape_id', 'id']) } : null;
    })
    .filter(Boolean);

  const filterCount = activeFilterChips.length;
  const framesLabel = `${totalResults} ${totalResults === 1 ? 'frame' : 'frames'}`;

  const applySearch = (value) => {
    setSearchQuery(value);
    setPage(1);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      if (value.trim()) url.searchParams.set('search', value.trim());
      else url.searchParams.delete('search');
      window.history.replaceState({}, '', url);
    }
  };

  return (
    <div className="products-page shop-page bg-bg mt-0">
      <div className="products-container shop-layout">
        {/* Desktop Refine column: compact, groups collapsed */}
        <aside className="filter-sidebar shop-refine" aria-label="Refine">
          <div className="shop-refine__head">
            <h2>Refine</h2>
            {filterCount > 0 && <button type="button" className="shop-link" onClick={handleReset}>Clear all</button>}
          </div>
          {renderFilters('side')}
        </aside>

        {/* Refine sheet (mobile and tablet): every filter, with Show N frames */}
        {mobileFilterOpen && typeof document !== 'undefined' && createPortal(
          <div className="shop-sheet-root" role="dialog" aria-modal="true" aria-label="Refine">
            <div className={`shop-sheet-scrim${drawerIn ? ' is-in' : ''}`} onClick={() => setMobileFilterOpen(false)} />
            <div className={`shop-sheet${drawerIn ? ' is-in' : ''}`}>
              <div className="shop-sheet__head">
                <h3>Refine</h3>
                <button type="button" className="shop-icon-btn" onClick={() => setMobileFilterOpen(false)} aria-label="Close refine">
                  <FiX size={20} />
                </button>
              </div>
              <div className="shop-sheet__body">{renderFilters('sheet')}</div>
              <div className="shop-sheet__foot">
                {filterCount > 0 && (
                  <button type="button" className="shop-btn" onClick={handleReset}>Clear all</button>
                )}
                <button type="button" className="shop-btn shop-btn--pri" onClick={() => setMobileFilterOpen(false)}>
                  Show {framesLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <main className="products-main shop-main">
          <div className="products-header shop-head">
            <h2>
              {loading ? 'Shop' : searchQuery ? `${totalResults} results for "${searchQuery}"` : 'Shop'}
            </h2>
            {!loading && !searchQuery && totalResults > 0 && (
              <p className="products-count">{framesLabel} in stock</p>
            )}
          </div>

          <div className="shop-tools">
            <div className="shop-search">
              <FiSearch size={18} aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => applySearch(e.target.value)}
                placeholder="Search model or colour"
                aria-label="Search frames"
                enterKeyHint="search"
              />
              {searchQuery && (
                <button type="button" className="shop-icon-btn shop-search__clear" onClick={() => applySearch('')} aria-label="Clear search">
                  <FiX size={16} />
                </button>
              )}
            </div>
            <button type="button" className="shop-btn shop-btn--pri shop-refine-btn" onClick={() => setMobileFilterOpen(true)} aria-label={`Open refine${filterCount ? `, ${filterCount} active` : ''}`}>
              <FiSliders size={18} aria-hidden="true" />
              Refine
              {filterCount > 0 && <span className="shop-refine-btn__count">{filterCount}</span>}
            </button>
          </div>

          <div className="shop-chips" role="group" aria-label="Quick filters">
            <span className="shop-chip is-on" aria-label="Showing only frames in stock">In stock</span>
            {quickShapes.map(q => {
              const on = selectedShapes.includes(q.id);
              return (
                <button
                  key={q.label}
                  type="button"
                  className={`shop-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleSelection(q.id, selectedShapes, setSelectedShapes)}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {activeFilterChips.length > 0 && (
            <div className="active-filters shop-active">
              {activeFilterChips.map(chip => (
                <button key={chip.key} type="button" className="filter-chip shop-chip shop-chip--x" onClick={chip.remove} aria-label={`Remove filter ${chip.label}`} title={`Remove ${chip.label}`}>
                  <span>{chip.label}</span>
                  <FiX size={14} aria-hidden="true" />
                </button>
              ))}
              <button type="button" className="filter-chip-clear shop-link" onClick={handleReset}>Clear all</button>
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
            <div className="products-grid-container grid" aria-busy="true" aria-live="polite">
              {Array.from({ length: limit }).map((_, i) => (
                <div key={`product-skeleton-${i}`} className="product-skeleton flex flex-col box-border bg-surface border border-border rounded-lg p-3 min-[381px]:p-4 sm:p-5 shadow-sm">
                  <Skeleton width="100%" height={180} radius={12} />
                  <Skeleton width="70%" height={16} className="product-skeleton__line" />
                  <Skeleton width="40%" height={14} className="product-skeleton__line" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="products-grid-container grid">
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
                    stock={Number(product.total_qty ?? product.warehouse_qty ?? 0)}
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
