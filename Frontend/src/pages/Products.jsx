import React, { useState, useEffect, useCallback } from 'react';
import '../styles/pages/Products.css';
import ProductCard from '../components/ProductCard';
import { isLoggedIn } from '../services/authService';
import {
  getProducts,
  getFeaturedProducts,
  getGenders,
  getShapes,
  getFrameTypes,
  getLensMaterials,
  getFrameMaterials,
  getColorCodes,
  getLensColors,
  getFrameColors,
  getBrands
} from '../services/apiService';

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
  const [allProducts, setAllProducts] = useState([]); // Store all products for pagination
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 21; // Products per page
  
  // Filter options from API
  const [brandsData, setBrandsData] = useState([]);
  const [gendersData, setGendersData] = useState([]);
  const [shapesData, setShapesData] = useState([]);
  const [lensColorsData, setLensColorsData] = useState([]);
  const [frameColorsData, setFrameColorsData] = useState([]);
  const [colorCodesData, setColorCodesData] = useState([]);
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


  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [brands, genders, shapes, frameTypes, lensMaterials, frameMaterials, colorCodes, lensColors, frameColors] = await Promise.all([
          getBrands().catch(() => []),
          getGenders().catch(() => []),
          getShapes().catch(() => []),
          getFrameTypes().catch(() => []),
          getLensMaterials().catch(() => []),
          getFrameMaterials().catch(() => []),
          getColorCodes().catch(() => []),
          getLensColors().catch(() => []),
          getFrameColors().catch(() => [])
        ]);
        
        setBrandsData(brands || []);
        setGendersData(genders || []);
        setShapesData(shapes || []);
        setFrameTypesData(frameTypes || []);
        setLensMaterialsData(lensMaterials || []);
        setFrameMaterialsData(frameMaterials || []);
        setColorCodesData(colorCodes || []);
        setLensColorsData(lensColors || []);
        setFrameColorsData(frameColors || []);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    
    fetchFilterOptions();
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

  // Fetch all products when filters change (not page)
  useEffect(() => {
    const fetchAllProducts = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching all products...');
        
        let allProducts = [];
        let currentPage = 1;
        let hasMorePages = true;
        const pageLimit = 100; // Get 100 products per page
        
        // Keep fetching pages until we get all products
        while (hasMorePages && currentPage <= 50) { // Safety limit of 50 pages
          console.log(`Fetching page ${currentPage}...`);
          
          const pageData = await getProducts(currentPage, pageLimit, null);
          const productsArray = Array.isArray(pageData) ? pageData : (pageData?.data || []);
          
          console.log(`Page ${currentPage} returned ${productsArray.length} products`);
          
          if (productsArray.length === 0) {
            // No more products, stop fetching
            hasMorePages = false;
          } else {
            allProducts = [...allProducts, ...productsArray];
            
            // If we got fewer products than the limit, this is the last page
            if (productsArray.length < pageLimit) {
              hasMorePages = false;
            } else {
              currentPage++;
            }
          }
        }
        
        console.log('[Products] Total products fetched:', allProducts.length);
        
        // Filter by status client-side to show only active products
        const activeProducts = allProducts.filter(product => {
          const status = (product.status || '').toLowerCase().trim();
          return status === 'active';
        });
        
        console.log('[Products] Active products after filter:', activeProducts.length);
        console.log('[Products] Sample active products:', activeProducts.slice(0, 3).map(p => ({
          id: p.product_id,
          model: p.model_no,
          status: p.status
        })));
        
        setAllProducts(activeProducts);
        setTotalResults(activeProducts.length);
        setTotalPages(Math.ceil(activeProducts.length / limit));
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err.message || 'Failed to fetch products');
        setAllProducts([]);
        setTotalResults(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllProducts();
  }, [limit]); // Remove buildFilters dependency to get all products initially

  // Update displayed products when page changes or search query changes
  useEffect(() => {
    console.log('[Products Pagination] Page:', page, 'Limit:', limit);
    console.log('[Products Pagination] Total products:', allProducts.length);
    console.log('[Products Search] Search query:', searchQuery);
    
    let filteredProducts = allProducts;
    
    // Apply search filter if search query exists
    if (searchQuery && searchQuery.trim()) {
      console.log('Applying search filter for:', searchQuery);
      filteredProducts = allProducts.filter(product => {
        const modelNo = (product.model_no || '').toLowerCase();
        const matches = modelNo.includes(searchQuery.toLowerCase());
        if (matches) {
          console.log('Product matches:', product.model_no);
        }
        return matches;
      });
      console.log('[Products Search] Filtered products by search:', filteredProducts.length);
    }
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const slicedProducts = filteredProducts.slice(startIndex, endIndex);
    console.log('[Products Pagination] Showing products:', startIndex, 'to', endIndex);
    console.log('[Products Pagination] Sliced products count:', slicedProducts.length);
    
    setProducts(slicedProducts);
    
    // Update total results and pages based on filtered products
    setTotalResults(filteredProducts.length);
    setTotalPages(Math.ceil(filteredProducts.length / limit));
  }, [page, allProducts, limit, searchQuery]);

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
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const handleViewMore = (productId, modelNo) => {
    // Products page already requires authentication, so just navigate
    // Add fromHome=false (or omit it) to indicate coming from products page
    if (typeof window !== 'undefined') {
      const url = `/product-detail?id=${productId}${modelNo ? `&model_no=${encodeURIComponent(modelNo)}` : ''}`;
      window.location.href = url;
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

  const FilterContent = () => (
    <>
      <div className="filter-header">
        <h2>Filter</h2>
        <button className="reset-button" onClick={handleReset}>RESET</button>
      </div>

      {/* Brands Filter */}
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('brands')}>
          <h3>Brands</h3>
          <span className={`chevron ${expandedSections.brands ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.brands && (
          <div className="filter-section-content">
            {brandsData.map(brand => {
              const brandId = brand.brand_id || brand.id;
              const brandName = brand.brand_name || brand.name || '';
              return (
                <label key={brandId} className="checkbox-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('frameMaterial')}>
          <h3>Frame Material</h3>
          <span className={`chevron ${expandedSections.frameMaterial ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.frameMaterial && (
          <div className="filter-section-content">
            {frameMaterialsData.map(material => {
              const materialId = material.frame_material_id || material.id;
              const materialName = material.frame_material || material.frame_material_name || material.name || '';
              return (
                <label key={materialId} className="checkbox-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('shape')}>
          <h3>Shape</h3>
          <span className={`chevron ${expandedSections.shape ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.shape && (
          <div className="filter-section-content">
            {shapesData.map(shape => {
              const shapeId = shape.shape_id || shape.id;
              const shapeName = shape.shape_name || shape.name || '';
              return (
                <label key={shapeId} className="checkbox-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('type')}>
          <h3>Frame Type</h3>
          <span className={`chevron ${expandedSections.type ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.type && (
          <div className="filter-section-content">
            {frameTypesData.map(frameType => {
              const typeId = frameType.frame_type_id || frameType.id;
              const typeName = frameType.frame_type || frameType.frame_type_name || frameType.name || '';
              return (
                <label key={typeId} className="radio-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('gender')}>
          <h3>Gender</h3>
          <span className={`chevron ${expandedSections.gender ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.gender && (
          <div className="filter-section-content">
            {gendersData.map(gender => {
              const genderId = gender.gender_id || gender.id;
              const genderName = gender.gender_name || gender.name || '';
              return (
                <label key={genderId} className="checkbox-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('lensColor')}>
          <h3>Lens Colour</h3>
          <span className={`chevron ${expandedSections.lensColor ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.lensColor && (
          <div className="filter-section-content">
            <div className="color-swatches">
              {lensColorsData.map(lensColor => {
                const colorId = lensColor.lens_color_id || lensColor.id;
                const colorName = lensColor.lens_color || lensColor.name || '';
                const colorHex = lensColor.hex || lensColor.color_hex || getColorHex(colorName);
                return (
                  <div
                    key={colorId}
                    className={`color-swatch ${selectedLensColor === colorId ? 'active' : ''}`}
                    style={{ backgroundColor: colorHex }}
                    onClick={() => setSelectedLensColor(selectedLensColor === colorId ? null : colorId)}
                    title={colorName}
                  ></div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lens Material Filter */}
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('lensMaterial')}>
          <h3>Lens Material</h3>
          <span className={`chevron ${expandedSections.lensMaterial ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.lensMaterial && (
          <div className="filter-section-content">
            {lensMaterialsData.map(material => {
              const materialId = material.lens_material_id || material.id;
              const materialName = material.lens_material || material.lens_material_name || material.name || '';
              return (
                <label key={materialId} className="checkbox-label">
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
      <div className="filter-section">
        <div className="filter-section-header" onClick={() => toggleSection('frameColor')}>
          <h3>Frame Colour</h3>
          <span className={`chevron ${expandedSections.frameColor ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        {expandedSections.frameColor && (
          <div className="filter-section-content">
            <div className="color-swatches">
              {frameColorsData.map(frameColor => {
                const colorId = frameColor.frame_color_id || frameColor.id;
                const colorName = frameColor.frame_color || frameColor.name || '';
                const colorHex = frameColor.hex || frameColor.color_hex || getColorHex(colorName);
                return (
                  <div
                    key={colorId}
                    className={`color-swatch ${selectedFrameColor === colorId ? 'active' : ''}`}
                    style={{ backgroundColor: colorHex }}
                    onClick={() => setSelectedFrameColor(selectedFrameColor === colorId ? null : colorId)}
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
    <div className="products-page">
      <div className="products-container">
        {/* Desktop Filter Sidebar (kept for larger viewports) */}
        <aside className="filter-sidebar">
          <FilterContent />
        </aside>

        {/* Mobile filter toggle - visible via CSS on small screens */}
        <button className="filter-toggle-btn" onClick={() => setMobileFilterOpen(true)}>
          Filters ▾
        </button>

        {/* Mobile centered modal for filter (closes when clicking backdrop) */}
        {mobileFilterOpen && (
          <div className={`mobile-filter-modal open`} onClick={() => setMobileFilterOpen(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <aside className="filter-sidebar">
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                  <button className="reset-button" onClick={() => setMobileFilterOpen(false)}>Close ✕</button>
                </div>
                <FilterContent />
              </aside>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <main className="products-main">
          <div className="products-header">
            <h2>
              {loading ? '' : searchQuery ? 
                `${totalResults} results for "${searchQuery}"` : 
                `${totalResults} results`
              }
            </h2>
            {searchQuery && (
              <button 
                className="clear-search-btn"
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
          <div className="products-grid-container">
            {loading ? (
              <div className="white-loader-container" style={{ gridColumn: '1 / -1' }}>
                <div className="white-loader"></div>
              </div>
            ) : error ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
                Error: {error}
              </div>
            ) : products.length > 0 ? (
              products.map(product => {
                const productId = product.product_id || product.id;
                const productName = product.model_no || product.name || 'Product';
                const productImage = getProductImage(product);
                
                return (
                  <ProductCard
                    key={productId}
                    productId={productId}
                    productName={productName}
                    productImage={productImage}
                    onViewMore={handleViewMore}
                  />
                );
              })
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'white', gridColumn: '1 / -1' }}>
                {searchQuery ? 
                  `No products found for "${searchQuery}"` : 
                  'No products found'
                }
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {!loading && products.length > 0 && totalPages > 1 && (
            <div className="products-pagination">
              <button 
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <div className="pagination-info">
                Page {page} of {totalPages}
              </div>
              <button 
                className="pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Products;
