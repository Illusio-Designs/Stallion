import React, { useMemo, useState, useEffect, useRef } from 'react';
import '../styles/pages/dashboard-products.css';
import '../styles/pages/dashboard-orders.css';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getBrands,
  getCollections,
  getGenders,
  getColorCodes,
  getShapes,
  getLensColors,
  getFrameColors,
  getFrameTypes,
  getLensMaterials,
  getFrameMaterials,
  uploadProductImage,
  bulkUploadProducts,
  getAllUploads,
  getTrays,
  getProductsInTray,
  deleteProductFromTray,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';

// Helper function to parse image_urls from various formats
// Handles: arrays, JSON strings like "[\"/uploads/products/image.webp\"]", plain strings
const parseImageUrls = (product) => {
  if (!product) return [];
  
  let imageUrls = [];
  
  // Check image_urls array
  if (Array.isArray(product.image_urls)) {
    imageUrls = product.image_urls.filter(url => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      return trimmed.length > 0 && trimmed !== '[]';
    });
  } 
  // Check if image_urls is a JSON string (like "[\"/uploads/products/image.webp\"]")
  // Also handles double-encoded JSON strings
  else if (product.image_urls && typeof product.image_urls === 'string') {
    let trimmed = product.image_urls.trim();
    if (trimmed.length > 0 && trimmed !== '[]') {
      // Try to parse as JSON array - may need multiple parsing attempts for double-encoded strings
      let parsed = null;
      let parseAttempts = 0;
      const maxAttempts = 3;
      let currentString = trimmed;
      
      while (parseAttempts < maxAttempts && (currentString.startsWith('[') || currentString.startsWith('"'))) {
        try {
          parsed = JSON.parse(currentString);
          if (Array.isArray(parsed)) {
            imageUrls = parsed.filter(url => {
              if (!url || typeof url !== 'string') return false;
              const trimmed = url.trim();
              return trimmed.length > 0 && trimmed !== '[]';
            });
            break; // Successfully parsed
          } else if (typeof parsed === 'string') {
            // If parsed result is still a string, try parsing again
            currentString = parsed;
            parseAttempts++;
            continue;
          } else {
            // If parsed is not an array or string, treat as single URL
            imageUrls = [currentString];
            break;
          }
        } catch (e) {
          // If JSON parsing fails, check if it's a single URL string
          if (currentString.startsWith('/') || currentString.startsWith('http')) {
            imageUrls = [currentString];
            break;
          }
          // If it looks like it might be double-encoded, try unescaping
          if (currentString.includes('\\')) {
            try {
              currentString = currentString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              parseAttempts++;
              continue;
            } catch (e2) {
              // If unescaping fails, treat as single URL string
              imageUrls = [currentString];
              break;
            }
          } else {
            // Not parseable, treat as single URL string
            imageUrls = [currentString];
            break;
          }
        }
      }
      
      // If we didn't successfully parse, treat as single URL string
      if (imageUrls.length === 0 && trimmed.length > 0) {
        imageUrls = [trimmed];
      }
    }
  }
  // Check legacy image_url string
  else if (product.image_url && typeof product.image_url === 'string') {
    const trimmed = product.image_url.trim();
    if (trimmed.length > 0 && trimmed !== '[]') {
      imageUrls = [trimmed];
    }
  }
  
  return imageUrls;
};

// Helper function to check if a product has valid image URLs
// Returns true only if there's at least one valid, non-empty image URL
// Handles: empty arrays [], arrays with empty strings, the string "[]", null, undefined
const hasValidImageUrls = (product) => {
  const imageUrls = parseImageUrls(product);
  return imageUrls.length > 0;
};

const DashboardProducts = () => {
  const [activeTab, setActiveTab] = useState('Products');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [openBulkUpload, setOpenBulkUpload] = useState(false);
  const [openImageSelectModal, setOpenImageSelectModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedBulkFile, setSelectedBulkFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageTargetProduct, setImageTargetProduct] = useState(null);
  const [orphanedImages, setOrphanedImages] = useState([]); // Images uploaded without product_id
  const [invalidImageUrls, setInvalidImageUrls] = useState(new Set()); // Track images that failed to load
  const [selectedImageIds, setSelectedImageIds] = useState(new Set()); // For multiple selection in modal
  const [allUploads, setAllUploads] = useState([]); // All uploaded images from API
  const imageInputRef = useRef(null);
  
  // Related data for dropdowns
  const [brands, setBrands] = useState([]);
  const [collections, setCollections] = useState([]);
  const [genders, setGenders] = useState([]);
  const [colorCodes, setColorCodes] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [lensColors, setLensColors] = useState([]);
  const [frameColors, setFrameColors] = useState([]);
  const [frameTypes, setFrameTypes] = useState([]);
  const [lensMaterials, setLensMaterials] = useState([]);
  const [frameMaterials, setFrameMaterials] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    model_no: '',
    gender_id: '',
    color_code_id: '',
    shape_id: '',
    lens_color_id: '',
    frame_color_id: '',
    frame_type_id: '',
    lens_material_id: '',
    frame_material_id: '',
    mrp: '',
    whp: '',
    size_mm: '',
    brand_id: '',
    collection_id: '',
    warehouse_qty: '',
    status: 'draft',
  });

  // Load orphaned images from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('orphanedImages');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out temporary blob URLs that won't work after refresh
        const validImages = parsed.filter(img => 
          img.url && !img.url.startsWith('blob:') && !img.isTemporary
        );
        if (validImages.length > 0) {
          setOrphanedImages(validImages);
        }
      }
    } catch (e) {
      console.error('Error loading orphaned images from localStorage:', e);
    }
  }, []);

  // Save orphaned images to localStorage whenever they change
  useEffect(() => {
    try {
      // Only save non-temporary images
      const toSave = orphanedImages.filter(img => !img.isTemporary || !img.url.startsWith('blob:'));
      if (toSave.length > 0) {
        localStorage.setItem('orphanedImages', JSON.stringify(toSave));
      } else {
        localStorage.removeItem('orphanedImages');
      }
    } catch (e) {
      console.error('Error saving orphaned images to localStorage:', e);
    }
  }, [orphanedImages]);

  // Fetch all images from API endpoint
  const fetchAllUploads = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the API service function which will try /products/images/all endpoint
      const data = await getAllUploads();
      
      // Helper function to construct full URL in format: https://stallion.nishree.com/uploads/products/filename.webp
      const constructFullUrl = (imagePath) => {
        if (!imagePath) return null;
        
        // If already a full URL, return as is (but ensure it's the correct format)
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          // If it's already a full URL with correct format, return as is
          if (imagePath.includes('/uploads/products/')) {
            return imagePath;
          }
          // If full URL but wrong path, extract filename and reconstruct
          const filename = imagePath.split('/').pop()?.split('?')[0];
          return filename ? `https://stallion.nishree.com/uploads/products/${filename}` : imagePath;
        }
        
        // If it's a relative path starting with /uploads/products/, prepend base URL
        if (imagePath.startsWith('/uploads/products/')) {
          return `https://stallion.nishree.com${imagePath}`;
        }
        
        // If it's just a filename (no slashes), construct full path
        if (!imagePath.includes('/')) {
          return `https://stallion.nishree.com/uploads/products/${imagePath}`;
          }
        
        // If it's a relative path without leading slash, assume it's a filename
        if (!imagePath.startsWith('/')) {
          return `https://stallion.nishree.com/uploads/products/${imagePath}`;
        }

        // For other relative paths, try to extract filename and construct URL
        const filename = imagePath.split('/').pop()?.split('?')[0];
        return filename ? `https://stallion.nishree.com/uploads/products/${filename}` : null;
      };
      
      // Handle different response formats from the API
      let imageFiles = [];
      
      if (Array.isArray(data)) {
        imageFiles = data.map((item, idx) => {
          // The API returns: { filename, path, url, size, uploadedAt, modifiedAt }
          // Prefer 'url' field as it contains the relative path like "/uploads/products/filename.webp"
          // Fallback to 'path' or 'filename' if 'url' is not available
          let imageUrl = item.url || item.path || item.image_url || item.imageUrl || 
                        item.file || item.filename || item.image || item.src;
          
          // Extract filename - prefer the filename field from API response
          let filename = item.filename || item.name || item.file;
          
          // If we have imageUrl, use it; otherwise try to construct from filename
          if (!imageUrl && filename) {
            imageUrl = filename;
          }
          
          // If filename is a full path, extract just the filename
          if (filename && filename.includes('/')) {
            filename = filename.split('/').pop()?.split('?')[0];
          }
          
          // Extract filename from URL if not provided
          if (!filename && imageUrl) {
            // Extract just the filename from the path/URL
            const urlParts = imageUrl.split('/');
            filename = urlParts[urlParts.length - 1]?.split('?')[0];
          }
          
          // Construct full URL in the required format: https://stallion.nishree.com/uploads/products/filename.webp
          // The constructFullUrl function will handle relative paths like "/uploads/products/filename.webp"
          const fullUrl = constructFullUrl(imageUrl);
          
          if (!fullUrl) {
            console.warn('Could not construct URL for item:', item);
            return null;
          }
          
          return {
            id: item.id || `upload-${idx}-${Date.now()}`,
            filename: filename || fullUrl.split('/').pop()?.split('?')[0] || 'unknown',
            path: fullUrl,
            url: fullUrl,
            image_url: fullUrl,
            size: item.size, // Include size if available
            uploadedAt: item.uploadedAt, // Include uploadedAt if available
            modifiedAt: item.modifiedAt, // Include modifiedAt if available
          };
        }).filter(item => item !== null); // Remove any items that couldn't be processed
        }
        
      // Remove duplicates based on URL
        const uniqueImages = [];
        const seenUrls = new Set();
        imageFiles.forEach(img => {
        const url = img.url || img.image_url;
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
            uniqueImages.push(img);
          }
        });
        
        setAllUploads(uniqueImages);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      setError(`Failed to load images: ${error.message}`);
      setAllUploads([]);
    } finally {
      setLoading(false);
    }
  };

  // Combined fetch function that waits for both products and related data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch both products and related data in parallel
      await Promise.all([
        fetchProductsWithoutLoading(),
        fetchRelatedData()
      ]);
    } catch (error) {
      console.error('Error fetching all data:', error);
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        setError(`Failed to load data: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch products without managing loading state (for use in combined fetch)
  const fetchProductsWithoutLoading = async () => {
    try {
      setError(null);
      // Send null filters to get all products
      const data = await getProducts(1, 3000, null); // Increased limit to show all products
      setProducts(data || []);
      
      // Get all product image URLs to identify which orphaned images are now assigned
      const productImageUrls = new Set(); // Store original URLs
      const productNormalizedUrls = new Set(); // Store normalized URLs for comparison
      const productImageFilenames = new Set();
      
      if (data && data.length > 0) {
        data.forEach(product => {
          // Handle image_urls array (API returns array)
          // Ensure imageUrls is always an array and filter out invalid values
          let imageUrls = [];
          if (Array.isArray(product.image_urls)) {
            // Filter out empty strings, whitespace-only strings, and the string "[]"
            imageUrls = product.image_urls.filter(url => {
              if (!url || typeof url !== 'string') return false;
              const trimmed = url.trim();
              return trimmed.length > 0 && trimmed !== '[]';
            });
          } else if (product.image_urls && typeof product.image_urls === 'string') {
            // If it's a string, check if it's valid (not empty, not "[]")
            const trimmed = product.image_urls.trim();
            if (trimmed.length > 0 && trimmed !== '[]') {
              imageUrls = [product.image_urls];
            }
          } else if (product.image_url && typeof product.image_url === 'string') {
            // Check legacy image_url string
            const trimmed = product.image_url.trim();
            if (trimmed.length > 0 && trimmed !== '[]') {
              imageUrls = [product.image_url];
            }
          }
          imageUrls.forEach(imageUrl => {
            if (imageUrl && typeof imageUrl === 'string') {
              const trimmed = imageUrl.trim();
              // Double-check it's not empty or "[]"
              if (trimmed.length > 0 && trimmed !== '[]') {
                productImageUrls.add(imageUrl);
                // Also store normalized URL for better comparison
                const normalizedUrl = normalizeImageUrl(imageUrl);
                if (normalizedUrl) {
                  productNormalizedUrls.add(normalizedUrl);
                }
                // Extract filename for comparison
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1]?.split('?')[0]?.split('#')[0];
                if (filename) {
                  productImageFilenames.add(filename);
                }
              }
            }
          });
        });
      }
      
      // If database has no images at all, clear all orphaned images
      // This ensures we don't show stale orphaned images when database is empty
      if (productImageFilenames.size === 0 && productImageUrls.size === 0) {
        setOrphanedImages([]);
        // Also clear from localStorage
        try {
          localStorage.removeItem('orphanedImages');
        } catch (e) {
          console.error('Error clearing orphaned images from localStorage:', e);
        }
      } else {
      // Remove orphaned images that are now assigned to products
      setOrphanedImages(prev => {
        return prev.filter(img => {
          const imageUrl = img.url || img.image_url;
          if (!imageUrl) return false;
          
            // Check if this image URL (original) is assigned to any product
          if (productImageUrls.has(imageUrl)) {
            return false; // Remove - it's assigned
          }
            
            // Check if normalized URL matches any assigned image
            const normalizedUrl = normalizeImageUrl(imageUrl);
            if (normalizedUrl && productNormalizedUrls.has(normalizedUrl)) {
            return false; // Remove - it's assigned
          }
          
          // Check by filename
          const urlParts = imageUrl.split('/');
            const filename = urlParts[urlParts.length - 1]?.split('?')[0]?.split('#')[0];
          if (filename && productImageFilenames.has(filename)) {
            return false; // Remove - it's assigned
          }
          
          // Check if filename matches
          if (img.fileName && productImageFilenames.has(img.fileName)) {
            return false; // Remove - it's assigned
          }
          
          return true; // Keep - still unassigned
        });
      });
      }
      
      // After fetching products, try to verify orphaned images
      // by checking if any match the pattern of existing product images
      if (orphanedImages.length > 0 && data && data.length > 0) {
        // Find a product with an image to understand the URL pattern
        const productWithImage = data.find(p => p.image_url);
        if (productWithImage && productWithImage.image_url) {
          // Extract the base path pattern from existing product images
          const imageUrl = productWithImage.image_url;
          const urlParts = imageUrl.split('/');
          const basePath = urlParts.slice(0, -1).join('/'); // Everything except filename
          
          // Update orphaned images with potential URLs based on product image pattern
          setOrphanedImages(prev => prev.map(img => {
            if (img.isTemporary && img.fileName && !img.verified) {
              // Construct URL using the same pattern as product images
              const constructedUrl = `${basePath}/${img.fileName}`;
              return {
                ...img,
                potentialUrls: [constructedUrl, ...(img.potentialUrls || [])]
              };
            }
            return img;
          }));
          
          // Verify the constructed URLs asynchronously
          setTimeout(async () => {
            setOrphanedImages(currentImages => {
              // Verify URLs asynchronously
              Promise.all(
                currentImages.map(async (img) => {
                  if (img.isTemporary && img.potentialUrls && !img.verified) {
                    for (const potentialUrl of img.potentialUrls) {
                      try {
                        const testResponse = await fetch(potentialUrl, { method: 'HEAD' });
                        if (testResponse.ok) {
                          URL.revokeObjectURL(img.url);
                          return {
                            ...img,
                            url: potentialUrl,
                            isTemporary: false,
                            verified: true
                          };
                        }
                      } catch (e) {
                        continue;
                      }
                    }
                  }
                  return img;
                })
              ).then(verifiedImages => {
                setOrphanedImages(verifiedImages);
              });
              
              return currentImages; // Return current state while verifying
            });
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        setError(`Failed to load products: ${error.message}`);
      }
      throw error; // Re-throw to be caught by fetchAllData
    }
  };

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'Products') {
      // Fetch products and related data together
      fetchAllData();
    } else if (activeTab === 'Media Gallery') {
      // Only fetch images from uploads/products folder - no products API call
      fetchAllUploads();
    } else if (activeTab === 'Unuploaded Media Gallery') {
      // Fetch products to check which ones don't have images when Unuploaded Media Gallery tab is active
      fetchAllData();
    }
  }, [activeTab]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  // Cleanup object URLs when component unmounts or images are removed
  useEffect(() => {
    return () => {
      orphanedImages.forEach(img => {
        if (img.isTemporary && img.url && img.url.startsWith('blob:')) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [orphanedImages]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Send null filters to get all products
      const data = await getProducts(1, 3000, null); // Increased limit to show all products
      setProducts(data || []);
      
      // Get all product image URLs to identify which orphaned images are now assigned
      const productImageUrls = new Set(); // Store original URLs
      const productNormalizedUrls = new Set(); // Store normalized URLs for comparison
      const productImageFilenames = new Set();
      
      if (data && data.length > 0) {
        data.forEach(product => {
          // Handle image_urls array (API returns array)
          // Ensure imageUrls is always an array and filter out invalid values
          let imageUrls = [];
          if (Array.isArray(product.image_urls)) {
            // Filter out empty strings, whitespace-only strings, and the string "[]"
            imageUrls = product.image_urls.filter(url => {
              if (!url || typeof url !== 'string') return false;
              const trimmed = url.trim();
              return trimmed.length > 0 && trimmed !== '[]';
            });
          } else if (product.image_urls && typeof product.image_urls === 'string') {
            // If it's a string, check if it's valid (not empty, not "[]")
            const trimmed = product.image_urls.trim();
            if (trimmed.length > 0 && trimmed !== '[]') {
              imageUrls = [product.image_urls];
            }
          } else if (product.image_url && typeof product.image_url === 'string') {
            // Check legacy image_url string
            const trimmed = product.image_url.trim();
            if (trimmed.length > 0 && trimmed !== '[]') {
              imageUrls = [product.image_url];
            }
          }
          imageUrls.forEach(imageUrl => {
            if (imageUrl && typeof imageUrl === 'string') {
              const trimmed = imageUrl.trim();
              // Double-check it's not empty or "[]"
              if (trimmed.length > 0 && trimmed !== '[]') {
                productImageUrls.add(imageUrl);
                // Also store normalized URL for better comparison
                const normalizedUrl = normalizeImageUrl(imageUrl);
                if (normalizedUrl) {
                  productNormalizedUrls.add(normalizedUrl);
                }
                // Extract filename for comparison
                const urlParts = imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1]?.split('?')[0]?.split('#')[0];
                if (filename) {
                  productImageFilenames.add(filename);
                }
              }
            }
          });
        });
      }
      
      // If database has no images at all, clear all orphaned images
      // This ensures we don't show stale orphaned images when database is empty
      if (productImageFilenames.size === 0 && productImageUrls.size === 0) {
        setOrphanedImages([]);
        // Also clear from localStorage
        try {
          localStorage.removeItem('orphanedImages');
        } catch (e) {
          console.error('Error clearing orphaned images from localStorage:', e);
        }
      } else {
      // Remove orphaned images that are now assigned to products
      setOrphanedImages(prev => {
        return prev.filter(img => {
          const imageUrl = img.url || img.image_url;
          if (!imageUrl) return false;
          
            // Check if this image URL (original) is assigned to any product
          if (productImageUrls.has(imageUrl)) {
            return false; // Remove - it's assigned
          }
            
            // Check if normalized URL matches any assigned image
            const normalizedUrl = normalizeImageUrl(imageUrl);
            if (normalizedUrl && productNormalizedUrls.has(normalizedUrl)) {
            return false; // Remove - it's assigned
          }
          
          // Check by filename
          const urlParts = imageUrl.split('/');
            const filename = urlParts[urlParts.length - 1]?.split('?')[0]?.split('#')[0];
          if (filename && productImageFilenames.has(filename)) {
            return false; // Remove - it's assigned
          }
          
          // Check if filename matches
          if (img.fileName && productImageFilenames.has(img.fileName)) {
            return false; // Remove - it's assigned
          }
          
          return true; // Keep - still unassigned
        });
      });
      }
      
      // After fetching products, try to verify orphaned images
      // by checking if any match the pattern of existing product images
      if (orphanedImages.length > 0 && data && data.length > 0) {
        // Find a product with an image to understand the URL pattern
        const productWithImage = data.find(p => p.image_url);
        if (productWithImage && productWithImage.image_url) {
          // Extract the base path pattern from existing product images
          const imageUrl = productWithImage.image_url;
          const urlParts = imageUrl.split('/');
          const basePath = urlParts.slice(0, -1).join('/'); // Everything except filename
          
          // Update orphaned images with potential URLs based on product image pattern
          setOrphanedImages(prev => prev.map(img => {
            if (img.isTemporary && img.fileName && !img.verified) {
              // Construct URL using the same pattern as product images
              const constructedUrl = `${basePath}/${img.fileName}`;
              return {
                ...img,
                potentialUrls: [constructedUrl, ...(img.potentialUrls || [])]
              };
            }
            return img;
          }));
          
          // Verify the constructed URLs asynchronously
          setTimeout(async () => {
            setOrphanedImages(currentImages => {
              // Verify URLs asynchronously
              Promise.all(
                currentImages.map(async (img) => {
                  if (img.isTemporary && img.potentialUrls && !img.verified) {
                    for (const potentialUrl of img.potentialUrls) {
                      try {
                        const testResponse = await fetch(potentialUrl, { method: 'HEAD' });
                        if (testResponse.ok) {
                          URL.revokeObjectURL(img.url);
                          return {
                            ...img,
                            url: potentialUrl,
                            isTemporary: false,
                            verified: true
                          };
                        }
                      } catch (e) {
                        continue;
                      }
                    }
                  }
                  return img;
                })
              ).then(verifiedImages => {
                setOrphanedImages(verifiedImages);
              });
              
              return currentImages; // Return current state while verifying
            });
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        setError(`Failed to load products: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    try {
      const [
        brandsData,
        collectionsData,
        gendersData,
        colorCodesData,
        shapesData,
        lensColorsData,
        frameColorsData,
        frameTypesData,
        lensMaterialsData,
        frameMaterialsData,
      ] = await Promise.all([
        getBrands().catch(() => []),
        getCollections().catch(() => []),
        getGenders().catch(() => []),
        getColorCodes().catch(() => []),
        getShapes().catch(() => []),
        getLensColors().catch(() => []),
        getFrameColors().catch(() => []),
        getFrameTypes().catch(() => []),
        getLensMaterials().catch(() => []),
        getFrameMaterials().catch(() => []),
      ]);
      
      setBrands(brandsData || []);
      setCollections(collectionsData || []);
      setGenders(gendersData || []);
      setColorCodes(colorCodesData || []);
      setShapes(shapesData || []);
      setLensColors(lensColorsData || []);
      setFrameColors(frameColorsData || []);
      setFrameTypes(frameTypesData || []);
      setLensMaterials(lensMaterialsData || []);
      setFrameMaterials(frameMaterialsData || []);
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  const handleAttachImage = async (row) => {
    // Save the product we want to attach an image to, then open the modal
    setImageTargetProduct(row);
    setError(null);
    // Fetch all uploads from API when opening the modal
    await fetchAllUploads();
    setOpenImageSelectModal(true);
  };

  const handleAttachExistingImage = async (imageItem) => {
    if (!imageTargetProduct || !imageItem || !imageItem.image_url) {
      setError('Invalid image or product selected');
      return;
    }

    const product = imageTargetProduct.data || imageTargetProduct;
    const productId = product.product_id || product.id || imageTargetProduct.id || imageTargetProduct.product_id;
    if (!productId) {
      setError('Product ID not found');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get the image URL - use relative path format like "/uploads/products/filename.webp"
      const imageUrl = imageItem.image_url;
      let imagePath = null;
      
      // Extract relative path for the backend
      if (imageUrl.includes('/uploads/products/')) {
        // Extract path after /uploads/products/
        imagePath = imageUrl.split('/uploads/products/')[1]?.split('?')[0];
        // Construct relative path
        imagePath = `/uploads/products/${imagePath}`;
      } else if (imageUrl.startsWith('/uploads/products/')) {
        imagePath = imageUrl.split('?')[0]; // Remove query params if any
      } else if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
        // If it's a full URL, extract the path part
        const urlObj = new URL(imageUrl);
        imagePath = urlObj.pathname;
      } else {
        // Just filename, construct path
        imagePath = `/uploads/products/${imageUrl.split('?')[0]}`;
      }

      if (!imagePath) {
        setError('Could not determine image path');
        return;
      }

      // Get current image_urls from product, or initialize as empty array
      // Filter out invalid values: empty strings, whitespace-only, and the string "[]"
      let currentImageUrls = [];
      if (Array.isArray(product.image_urls)) {
        currentImageUrls = product.image_urls.filter(url => {
          if (!url || typeof url !== 'string') return false;
          const trimmed = url.trim();
          return trimmed.length > 0 && trimmed !== '[]';
        });
      } else if (product.image_url && typeof product.image_url === 'string') {
        const trimmed = product.image_url.trim();
        if (trimmed.length > 0 && trimmed !== '[]') {
          currentImageUrls = [product.image_url];
        }
      }

      // Check if image is already attached
      if (currentImageUrls.some(url => url === imagePath || url.includes(imagePath.split('/').pop()))) {
        showError('Image is already attached to this product');
        return;
      }
      
      // Add the new image URL to the array
      const updatedImageUrls = [...currentImageUrls, imagePath];
      
      // Prepare update data with all product fields
      const updateData = {
        model_no: product.model_no || '',
        gender_id: parseInt(product.gender_id) || 0,
        color_code_id: parseInt(product.color_code_id) || 0,
        shape_id: parseInt(product.shape_id) || 0,
        lens_color_id: parseInt(product.lens_color_id) || 0,
        frame_color_id: parseInt(product.frame_color_id) || 0,
        frame_type_id: parseInt(product.frame_type_id) || 0,
        lens_material_id: parseInt(product.lens_material_id) || 0,
        frame_material_id: parseInt(product.frame_material_id) || 0,
        mrp: parseFloat(product.mrp) || 0,
        whp: parseFloat(product.whp) || 0,
        size_mm: product.size_mm || '',
        brand_id: product.brand_id || '',
        collection_id: product.collection_id || '',
        warehouse_qty: parseInt(product.warehouse_qty) || 0,
        tray_qty: parseInt(product.tray_qty) || 0,
        total_qty: parseInt(product.total_qty) || 0,
        status: 'active', // Update status to active when image is attached
        image_urls: updatedImageUrls, // Update image_urls array
      };

      // Update product using PUT API
      await updateProduct(productId, updateData);
      
      // Refresh products to get updated values
      await fetchProductsWithoutLoading();
      await fetchRelatedData();
      await fetchAllUploads(); // Refresh the images list in the modal

      showSuccess(`Image attached to product ${product.model_no || 'successfully'}!`);
      setOpenImageSelectModal(false);
      setImageTargetProduct(null);
      setSelectedImageIds(new Set()); // Clear selection
    } catch (error) {
      console.error('Error attaching image:', error);
      const message = `Failed to attach image: ${error.message}`;
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle attaching multiple selected images
  const handleAttachMultipleImages = async () => {
    if (!imageTargetProduct || selectedImageIds.size === 0) {
      setError('Please select at least one image to attach');
      return;
    }

    const product = imageTargetProduct.data || imageTargetProduct;
    const productId = product.product_id || product.id || imageTargetProduct.id || imageTargetProduct.product_id;
    if (!productId) {
      setError('Product ID not found');
      return;
    }

    // Get selected images from availableImagesForModal (images from API)
    const imagesToAttach = availableImagesForModal.filter(img => selectedImageIds.has(img.id));
    
    if (imagesToAttach.length === 0) {
      setError('No valid images selected');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Extract image paths for all selected images
      const newImagePaths = [];

      for (const imageItem of imagesToAttach) {
          const imageUrl = imageItem.image_url;
        let imagePath = null;
          
        // Extract relative path for the backend
          if (imageUrl.includes('/uploads/products/')) {
          const filename = imageUrl.split('/uploads/products/')[1]?.split('?')[0];
          imagePath = `/uploads/products/${filename}`;
        } else if (imageUrl.startsWith('/uploads/products/')) {
          imagePath = imageUrl.split('?')[0];
        } else if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
          const urlObj = new URL(imageUrl);
          imagePath = urlObj.pathname;
        } else {
          imagePath = `/uploads/products/${imageUrl.split('?')[0]}`;
        }

        if (imagePath) {
          newImagePaths.push(imagePath);
        }
      }

      if (newImagePaths.length === 0) {
        setError('Could not determine image paths for selected images');
        return;
      }

      // Get current image_urls from product, or initialize as empty array
      // Filter out invalid values: empty strings, whitespace-only, and the string "[]"
      let currentImageUrls = [];
      if (Array.isArray(product.image_urls)) {
        currentImageUrls = product.image_urls.filter(url => {
          if (!url || typeof url !== 'string') return false;
          const trimmed = url.trim();
          return trimmed.length > 0 && trimmed !== '[]';
        });
      } else if (product.image_url && typeof product.image_url === 'string') {
        const trimmed = product.image_url.trim();
        if (trimmed.length > 0 && trimmed !== '[]') {
          currentImageUrls = [product.image_url];
        }
      }

      // Filter out duplicates - only add images that aren't already attached
      const uniqueNewPaths = newImagePaths.filter(newPath => {
        const filename = newPath.split('/').pop();
        return !currentImageUrls.some(existingUrl => 
          existingUrl === newPath || existingUrl.includes(filename)
        );
      });

      if (uniqueNewPaths.length === 0) {
        showError('All selected images are already attached to this product');
                    return;
                  }
                  
      // Combine current and new image URLs
      const updatedImageUrls = [...currentImageUrls, ...uniqueNewPaths];

      // Prepare update data with all product fields
      const updateData = {
        model_no: product.model_no || '',
        gender_id: parseInt(product.gender_id) || 0,
        color_code_id: parseInt(product.color_code_id) || 0,
        shape_id: parseInt(product.shape_id) || 0,
        lens_color_id: parseInt(product.lens_color_id) || 0,
        frame_color_id: parseInt(product.frame_color_id) || 0,
        frame_type_id: parseInt(product.frame_type_id) || 0,
        lens_material_id: parseInt(product.lens_material_id) || 0,
        frame_material_id: parseInt(product.frame_material_id) || 0,
        mrp: parseFloat(product.mrp) || 0,
        whp: parseFloat(product.whp) || 0,
        size_mm: product.size_mm || '',
        brand_id: product.brand_id || '',
        collection_id: product.collection_id || '',
        warehouse_qty: parseInt(product.warehouse_qty) || 0,
        tray_qty: parseInt(product.tray_qty) || 0,
        total_qty: parseInt(product.total_qty) || 0,
        status: 'active', // Update status to active when images are attached
        image_urls: updatedImageUrls, // Update image_urls array with all images
      };

      // Update product using PUT API
      await updateProduct(productId, updateData);
      
      // Refresh products to get updated values
      await fetchProductsWithoutLoading();
      await fetchRelatedData();
      await fetchAllUploads(); // Refresh the images list in the modal

      const skippedCount = newImagePaths.length - uniqueNewPaths.length;
      const successMessage = skippedCount > 0
        ? `${uniqueNewPaths.length} image(s) attached successfully! ${skippedCount} were already attached.`
        : `${uniqueNewPaths.length} image(s) attached successfully!`;
      
      showSuccess(successMessage);
      setOpenImageSelectModal(false);
      setImageTargetProduct(null);
      setSelectedImageIds(new Set());
    } catch (error) {
      console.error('Error attaching images:', error);
      const message = `Failed to attach images: ${error.message}`;
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    return products.map(product => {
      const brand = brands.find(b => (b.brand_id || b.id) === product.brand_id);
      const collection = collections.find(c => (c.collection_id || c.id) === product.collection_id);
      const gender = genders.find(g => (g.gender_id || g.id) === product.gender_id);
      const colorCode = colorCodes.find(cc => (cc.color_code_id || cc.id) === product.color_code_id);
      const shape = shapes.find(s => (s.shape_id || s.id) === product.shape_id);
      const lensColor = lensColors.find(lc => (lc.lens_color_id || lc.id) === product.lens_color_id);
      const frameColor = frameColors.find(fc => (fc.frame_color_id || fc.id) === product.frame_color_id);
      const frameType = frameTypes.find(ft => (ft.frame_type_id || ft.id) === product.frame_type_id);
      const lensMaterial = lensMaterials.find(lm => (lm.lens_material_id || lm.id) === product.lens_material_id);
      const frameMaterial = frameMaterials.find(fm => (fm.frame_material_id || fm.id) === product.frame_material_id);
      
      // Check if product has valid images using helper function
      // This properly handles empty arrays [], arrays with empty strings, and the string "[]"
      const hasUploadedMedia = hasValidImageUrls(product);
      
      return {
        id: product.product_id || product.id,
        product_id: product.product_id || product.id,
        model_no: product.model_no || '',
        gender_id: product.gender_id || '',
        gender_name: gender?.gender_name || gender?.name || 'N/A',
        color_code_id: product.color_code_id || '',
        color_code_name: colorCode?.color_code || colorCode?.name || 'N/A',
        shape_id: product.shape_id || '',
        shape_name: shape?.shape_name || shape?.name || 'N/A',
        lens_color_id: product.lens_color_id || '',
        lens_color_name: lensColor?.lens_color || lensColor?.name || 'N/A',
        frame_color_id: product.frame_color_id || '',
        frame_color_name: frameColor?.frame_color || frameColor?.name || 'N/A',
        frame_type_id: product.frame_type_id || '',
        frame_type_name: frameType?.frame_type || frameType?.name || 'N/A',
        lens_material_id: product.lens_material_id || '',
        lens_material_name: lensMaterial?.lens_material || lensMaterial?.name || 'N/A',
        frame_material_id: product.frame_material_id || '',
        frame_material_name: frameMaterial?.frame_material || frameMaterial?.name || 'N/A',
        brand_id: product.brand_id || '',
        brand: brand?.brand_name || 'N/A',
        collection_id: product.collection_id || '',
        collection: collection?.collection_name || 'N/A',
        mrp: product.mrp || '0.00',
        mrp_formatted: `₹${parseFloat(product.mrp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        whp: product.whp || '0.00',
        whp_formatted: `₹${parseFloat(product.whp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        size_mm: product.size_mm || '',
        warehouse_qty: product.warehouse_qty || 0,
        tray_qty: product.tray_qty || 0,
        total_qty: product.total_qty || product.qty || 0,
        status: product.status || 'draft',
        hasUploadedMedia: hasUploadedMedia,
        data: product,
      };
    });
  }, [products, brands, collections, genders, colorCodes, shapes, lensColors, frameColors, frameTypes, lensMaterials, frameMaterials]);

  const uploadedProducts = useMemo(
    () => products.filter(p => hasValidImageUrls(p)),
    [products]
  );

  // Helper function to extract relative path from absolute server paths
  // Always returns path in format: /uploads/products/filename.jpg
  const extractRelativePath = (path) => {
    if (!path) return null;
    
    // Ensure path is a string
    if (typeof path !== 'string') return null;
    
    // Extract filename from any path format
    let filename = path;
    
    // If path contains slashes, extract the filename
    if (path.includes('/')) {
      filename = path.split('/').pop();
    }
    
    // Remove any query parameters or fragments from filename
    filename = filename.split('?')[0].split('#')[0];
    
    // Trim whitespace and validate filename is not empty
    filename = filename.trim();
    if (!filename || filename.length === 0) return null;
    
    // Always return in the format: /uploads/products/filename
    return `/uploads/products/${filename}`;
  };

  // Helper function to convert image URLs to use live API
  // Always ensures paths are in format: https://stallion.nishree.com/uploads/products/filename.jpg
  const normalizeImageUrl = (url) => {
    if (!url) return null;

    // Temporary blob URLs render as-is
    if (url.startsWith('blob:')) return url;

    // Absolute URLs - extract relative path if it contains /uploads/ to ensure /products/ segment
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Check if URL contains /uploads/ but might be missing /products/
      const uploadsIndex = url.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        const pathAfterUploads = url.substring(uploadsIndex + '/uploads/'.length);
        // If path doesn't start with 'products/', extract filename and reconstruct
        if (!pathAfterUploads.startsWith('products/')) {
          const filename = pathAfterUploads.split('/').pop().split('?')[0].split('#')[0];
          const baseUrl = url.substring(0, url.indexOf('/uploads/'));
          return `${baseUrl}/uploads/products/${filename}`;
        }
      }
      return url; // Already has correct format or doesn't need normalization
    }
    
    // For relative paths, use extractRelativePath to ensure /uploads/products/ format
    const relativePath = extractRelativePath(url);
    if (!relativePath) return null;

    // Resolve base for images:
    // 1) NEXT_PUBLIC_IMAGE_BASE_URL (if provided)
    // 2) NEXT_PUBLIC_API_URL (strip /api)
    // 3) fallback to live API URL
    const getImageBase = () => {
      if (typeof window === 'undefined') return '';
      const imgEnv = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '';
      if (imgEnv) return imgEnv.replace(/\/$/, '');

      const apiEnv = process.env.NEXT_PUBLIC_API_URL || '';
      if (apiEnv) return apiEnv.replace(/\/api\/?$/, '').replace(/\/$/, '');

      // Default to live API URL
      return 'https://stallion.nishree.com';
    };

    const base = getImageBase();
    return `${base}${relativePath}`;
  };

  // Display all images from uploads/products folder for Media Gallery
  // Shows images with their assigned/unassigned status based on products
  const allMediaImages = useMemo(() => {
    // Get all product image URLs and filenames to check assignment status
    const productImageUrls = new Set();
    const productImageFilenames = new Set();
    const productImagePaths = new Set(); // Store paths in various formats for comparison
    
    products.forEach(product => {
      // Use helper function to parse image_urls from various formats (array, JSON string, plain string)
      const imageUrls = parseImageUrls(product);
      
      imageUrls.forEach(imageUrl => {
        if (imageUrl && typeof imageUrl === 'string') {
          const trimmed = imageUrl.trim();
          // Double-check it's not empty or "[]"
          if (trimmed.length > 0 && trimmed !== '[]') {
          // Add the URL as-is
          productImageUrls.add(imageUrl);
          
          // Normalize and add
          const normalizedUrl = normalizeImageUrl(imageUrl);
          if (normalizedUrl) {
            productImageUrls.add(normalizedUrl);
          }
          
          // Extract filename
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1]?.split('?')[0];
          if (filename) {
            productImageFilenames.add(filename);
          }
          
          // Add various path formats for comparison
          // Full path, relative path, and filename
          if (imageUrl.includes('/uploads/products/')) {
            const path = imageUrl.split('/uploads/products/')[1]?.split('?')[0];
            if (path) {
              productImagePaths.add(`/uploads/products/${path}`);
              productImagePaths.add(path);
            }
          } else if (imageUrl.startsWith('/uploads/products/')) {
            productImagePaths.add(imageUrl.split('?')[0]);
            const path = imageUrl.replace('/uploads/products/', '').split('?')[0];
            if (path) {
              productImagePaths.add(path);
            }
          }
          }
        }
      });
    });
    
    // Only include images from allUploads (from uploads/products folder)
    const mediaImages = [];
    const seenUrls = new Set();
    
    if (allUploads && Array.isArray(allUploads) && allUploads.length > 0) {
      allUploads.forEach((upload, idx) => {
        // Handle different possible response formats
        let imageUrl = upload.path || upload.url || upload.image_url || upload.file || upload.filename;
        let fileName = upload.filename || upload.name || upload.file;
        
        // If fileName is a full path, extract just the filename
        if (fileName && fileName.includes('/')) {
          fileName = fileName.split('/').pop()?.split('?')[0];
        }
        
        // If imageUrl is just a filename, construct full path
        if (imageUrl && !imageUrl.includes('/') && !imageUrl.startsWith('http')) {
          imageUrl = `/uploads/products/${imageUrl}`;
        }
        
        // Skip if no valid URL
        if (!imageUrl) return;
        
        // Ensure URL is normalized and from products folder
        const normalizedUrl = normalizeImageUrl(imageUrl);
        if (!normalizedUrl) return;
        
        // Only include images from uploads/products folder
        if (!normalizedUrl.includes('/uploads/products/')) {
          return; // Skip - not from products folder
        }
        
        // Skip duplicates
        if (seenUrls.has(normalizedUrl)) return;
        seenUrls.add(normalizedUrl);
        
        // Extract filename if not provided
        if (!fileName) {
          const urlParts = normalizedUrl.split('/');
          fileName = urlParts[urlParts.length - 1]?.split('?')[0];
        }
        
        // Check if this image is assigned to any product
        let isAssigned = false;
        let assignedProduct = null;
        
        // Helper function to extract filename from URL
        const getFilenameFromUrl = (url) => {
          if (!url) return null;
          const parts = url.split('/');
          return parts[parts.length - 1]?.split('?')[0] || null;
        };
        
        // Helper function to extract path after /uploads/products/
        const getPathAfterProducts = (url) => {
          if (!url) return null;
          if (url.includes('/uploads/products/')) {
            return url.split('/uploads/products/')[1]?.split('?')[0] || null;
          }
          return null;
        };
        
        // Get all variations of the current image URL for comparison
        const normalizedUrlNoQuery = normalizedUrl.split('?')[0];
        const imageUrlNoQuery = imageUrl.split('?')[0];
        const currentFileName = fileName || getFilenameFromUrl(normalizedUrl) || getFilenameFromUrl(imageUrl);
        const currentPath = getPathAfterProducts(normalizedUrl) || getPathAfterProducts(imageUrl);
        
        // Check by full URL (normalized and original) - check all variations
        const urlVariations = [
          normalizedUrl,
          imageUrl,
          normalizedUrlNoQuery,
          imageUrlNoQuery,
          `https://stallion.nishree.com${normalizedUrl}`,
          `https://stallion.nishree.com${imageUrl}`,
          `https://stallion.nishree.com${normalizedUrlNoQuery}`,
          `https://stallion.nishree.com${imageUrlNoQuery}`
        ];
        
        for (const urlVar of urlVariations) {
          if (productImageUrls.has(urlVar)) {
            isAssigned = true;
            break;
          }
        }
        
        // Check by filename - also check normalized filename
        if (!isAssigned && currentFileName) {
          if (productImageFilenames.has(currentFileName)) {
            isAssigned = true;
          } else {
            // Also check if any product image filename matches (case-insensitive)
            for (const productFilename of productImageFilenames) {
              if (productFilename.toLowerCase() === currentFileName.toLowerCase()) {
                isAssigned = true;
                break;
              }
            }
          }
        }
        
        // Check by path formats - check all variations
        if (!isAssigned && currentPath) {
          const pathVariations = [
            `/uploads/products/${currentPath}`,
            currentPath,
            normalizedUrlNoQuery,
            imageUrlNoQuery,
            `https://stallion.nishree.com/uploads/products/${currentPath}`,
            `https://stallion.nishree.com${normalizedUrlNoQuery}`,
            `https://stallion.nishree.com${imageUrlNoQuery}`
          ];
          
          for (const pathVar of pathVariations) {
            if (productImagePaths.has(pathVar)) {
              isAssigned = true;
              break;
            }
          }
        }
        
        // Additional check: directly compare against all product images
        if (!isAssigned) {
          for (const product of products) {
            const productImageUrls = parseImageUrls(product);
            for (const productImageUrl of productImageUrls) {
              const normalizedProductUrl = normalizeImageUrl(productImageUrl);
              const productFileName = getFilenameFromUrl(normalizedProductUrl) || getFilenameFromUrl(productImageUrl);
              const productPath = getPathAfterProducts(normalizedProductUrl) || getPathAfterProducts(productImageUrl);
              
              // Compare URLs
              if (normalizedProductUrl === normalizedUrl || 
                  normalizedProductUrl === imageUrl ||
                  productImageUrl === normalizedUrl ||
                  productImageUrl === imageUrl ||
                  normalizedProductUrl?.split('?')[0] === normalizedUrlNoQuery ||
                  productImageUrl?.split('?')[0] === imageUrlNoQuery) {
                isAssigned = true;
                assignedProduct = product;
                break;
              }
              
              // Compare filenames
              if (currentFileName && productFileName && 
                  (currentFileName === productFileName || 
                   currentFileName.toLowerCase() === productFileName.toLowerCase())) {
                isAssigned = true;
                assignedProduct = product;
                break;
              }
              
              // Compare paths
              if (currentPath && productPath && currentPath === productPath) {
                isAssigned = true;
                assignedProduct = product;
                break;
              }
            }
            if (isAssigned) break;
          }
        }
        
        // If assigned, find the product
        if (isAssigned && !assignedProduct) {
          assignedProduct = products.find(p => {
            // Use helper function to parse image_urls
            const productImageUrls = parseImageUrls(p);
            
            return productImageUrls.some(url => {
              const normalizedProductUrl = normalizeImageUrl(url);
              const productUrlNoQuery = url.split('?')[0];
              const normalizedProductUrlNoQuery = normalizedProductUrl ? normalizedProductUrl.split('?')[0] : null;
              
              // Check by full URL
              if (normalizedProductUrl === normalizedUrl || 
                  url === imageUrl || 
                  normalizedProductUrl === imageUrl || 
                  url === normalizedUrl ||
                  normalizedProductUrlNoQuery === normalizedUrlNoQuery ||
                  productUrlNoQuery === imageUrlNoQuery) {
                return true;
              }
              
              // Check by filename
              const productFileName = getFilenameFromUrl(url) || getFilenameFromUrl(normalizedProductUrl);
              if (productFileName && productFileName === fileName) {
                return true;
              }
              
              // Check by path
              const productPath = getPathAfterProducts(normalizedProductUrl || url);
              const imagePath = getPathAfterProducts(normalizedUrl);
              if (productPath && imagePath && productPath === imagePath) {
                return true;
              }
              
              return false;
            });
          });
        }
        
        mediaImages.push({
          id: `media-${idx}-${upload.id || Date.now()}`,
          image_url: normalizedUrl,
          originalImageUrl: imageUrl,
          model_no: upload.model_no || 'Unassigned',
          brand_name: upload.brand_name || 'N/A',
          collection_name: upload.collection_name || 'N/A',
          type: isAssigned ? 'assigned' : 'unassigned',
          isTemporary: false,
          fileName: fileName,
          originalData: upload,
          source: 'uploads', // Mark as from uploads folder
          assignedProduct: assignedProduct, // Store the assigned product information
          productId: assignedProduct ? (assignedProduct.id || assignedProduct.product_id) : null,
          productData: assignedProduct // Keep for backward compatibility
        });
      });
    }
    
    return mediaImages;
  }, [allUploads, products]);

  // Get images from API for the modal - show all images from /products/images/all endpoint
  // Filter to only show images that are NOT assigned to any product
  const availableImagesForModal = useMemo(() => {
    // Get all product image URLs and filenames to exclude assigned images
    const productImageUrls = new Set();
    const productImageFilenames = new Set();
    
    products.forEach(product => {
      // Handle image_urls array (API returns array)
      // Filter out invalid values: empty strings, whitespace-only, and the string "[]"
      let imageUrls = [];
      if (Array.isArray(product.image_urls)) {
        imageUrls = product.image_urls.filter(url => {
          if (!url || typeof url !== 'string') return false;
          const trimmed = url.trim();
          return trimmed.length > 0 && trimmed !== '[]';
        });
      } else if (product.image_urls && typeof product.image_urls === 'string') {
        const trimmed = product.image_urls.trim();
        if (trimmed.length > 0 && trimmed !== '[]') {
          imageUrls = [product.image_urls];
        }
      } else if (product.image_url && typeof product.image_url === 'string') {
        const trimmed = product.image_url.trim();
        if (trimmed.length > 0 && trimmed !== '[]') {
          imageUrls = [product.image_url];
        }
      }
      imageUrls.forEach(imageUrl => {
        if (imageUrl && typeof imageUrl === 'string') {
          const trimmed = imageUrl.trim();
          // Double-check it's not empty or "[]"
          if (trimmed.length > 0 && trimmed !== '[]') {
            productImageUrls.add(imageUrl);
            // Normalize URL for comparison
            const normalizedUrl = normalizeImageUrl(imageUrl);
            if (normalizedUrl) {
              productImageUrls.add(normalizedUrl);
            }
            const urlParts = imageUrl.split('/');
            const filename = urlParts[urlParts.length - 1]?.split('?')[0];
            if (filename) {
              productImageFilenames.add(filename);
            }
          }
        }
      });
    });
    
    // Filter allMediaImages to show only unassigned images
    return allMediaImages
      .filter((img) => {
        const imageUrl = img.image_url;
        if (!imageUrl) return false;
        
        // Exclude blob URLs (temporary)
        if (imageUrl.startsWith('blob:')) return false;
        
        // Exclude images that failed to load
        if (invalidImageUrls.has(imageUrl)) {
          return false;
        }
        
        // Exclude if image type is 'assigned' (most reliable check)
        if (img.type === 'assigned') {
          return false; // This image is assigned
        }
        
        // Exclude if image has an assignedProduct
        if (img.assignedProduct || img.productId || img.productData) {
          return false; // This image is assigned to a product
        }
        
        // Exclude if this image is assigned to any product
        if (productImageUrls.has(imageUrl)) {
          return false; // This image is assigned
        }
        
        // Check by filename
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1]?.split('?')[0];
        if (filename && productImageFilenames.has(filename)) {
          return false; // This image is assigned
        }
        
        // Check by fileName property
        if (img.fileName && productImageFilenames.has(img.fileName)) {
          return false; // This image is assigned
        }
        
        return true; // Image is available for assignment
      })
      .map((img, idx) => {
        return {
          id: img.id || `modal-${idx}-${Date.now()}`,
          image_url: img.image_url,
          model_no: img.model_no || 'Unassigned',
          brand_name: img.brand_name || 'N/A',
          collection_name: img.collection_name || 'N/A',
          type: 'unassigned',
          isTemporary: false,
          fileName: img.fileName || (img.image_url.includes('/uploads/products/') 
            ? img.image_url.split('/uploads/products/')[1]?.split('?')[0] 
            : null),
          originalData: img // Keep reference
        };
      });
  }, [allMediaImages, invalidImageUrls, products]);

  // Get only orphaned/unassigned images for the modal (legacy - kept for backward compatibility)
  // Filter to only show images that are in uploads/products directory, are valid, and NOT assigned to any product
  const orphanedMediaImages = useMemo(() => {
    // Get all product image URLs and filenames to exclude assigned images
    const productImageUrls = new Set();
    const productImageFilenames = new Set();
    
    products.forEach(product => {
      // Handle image_urls array (API returns array)
      // Ensure imageUrls is always an array
      let imageUrls = [];
      if (Array.isArray(product.image_urls)) {
        imageUrls = product.image_urls;
      } else if (product.image_urls) {
        // If it's a string or other truthy value, convert to array
        imageUrls = [product.image_urls];
      } else if (product.image_url) {
        imageUrls = [product.image_url];
      }
      imageUrls.forEach(imageUrl => {
        if (imageUrl) {
          productImageUrls.add(imageUrl);
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1]?.split('?')[0];
          if (filename) {
            productImageFilenames.add(filename);
          }
        }
      });
    });
    
    return orphanedImages
      .filter((img) => {
        const imageUrl = img.url || img.image_url || (typeof img === 'string' ? img : null);
        if (!imageUrl) return false;
        
        // Exclude blob URLs (temporary)
        if (imageUrl.startsWith('blob:')) return false;
        
        // Exclude images that failed to load
        const normalizedUrl = normalizeImageUrl(imageUrl);
        if (invalidImageUrls.has(normalizedUrl) || invalidImageUrls.has(imageUrl)) {
          return false;
        }
        
        // Exclude if this image is assigned to any product
        if (productImageUrls.has(imageUrl) || productImageUrls.has(normalizedUrl)) {
          return false; // This image is assigned
        }
        
        // Check by filename
        const urlParts = normalizedUrl.split('/');
        const filename = urlParts[urlParts.length - 1]?.split('?')[0];
        if (filename && productImageFilenames.has(filename)) {
          return false; // This image is assigned
        }
        
        // Check by fileName property
        if (img.fileName && productImageFilenames.has(img.fileName)) {
          return false; // This image is assigned
        }
        
        // Check if the image is in uploads/products directory
        // Accept if URL contains /uploads/products/ or has a valid filename
        const hasUploadsProducts = normalizedUrl.includes('/uploads') || 
                                   imageUrl.includes('/uploads') ||
                                   (img.fileName && img.fileName.length > 0);
        
        return hasUploadsProducts;
      })
      .map((img, idx) => {
        const imageUrl = img.url || img.image_url || (typeof img === 'string' ? img : null);
        const normalizedUrl = normalizeImageUrl(imageUrl);
        
        return {
          id: `orphaned-${idx}-${img.uploadedAt || Date.now()}`,
          image_url: normalizedUrl,
          model_no: img.model_no || 'Unassigned',
          brand_name: img.brand_name || 'N/A',
          collection_name: img.collection_name || 'N/A',
          type: 'orphaned',
          isTemporary: img.isTemporary,
          fileName: img.fileName || (normalizedUrl.includes('/uploads/products/') 
            ? normalizedUrl.split('/uploads/products/')[1]?.split('?')[0] 
            : null),
          originalData: img // Keep reference for removal
        };
      });
  }, [orphanedImages, invalidImageUrls, products]);

  const unuploadedRows = useMemo(
    () => rows.filter(r => {
      const product = r.data;
      
      // Check if product has valid images using helper function
      // Products with empty array [], arrays with empty strings, or the string "[]" should appear in unuploaded gallery
      // Return products that have NO valid images
      return !hasValidImageUrls(product);
    }),
    [rows]
  );

  const filteredRowsByTab = useMemo(() => {
    if (activeTab === 'Products') return rows; // Show ALL products (with or without images)
    if (activeTab === 'Unuploaded Media Gallery') return unuploadedRows; // Show ONLY products WITHOUT images
    return rows;
  }, [rows, unuploadedRows, activeTab]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      model_no: '',
      gender_id: '',
      color_code_id: '',
      shape_id: '',
      lens_color_id: '',
      frame_color_id: '',
      frame_type_id: '',
      lens_material_id: '',
      frame_material_id: '',
      mrp: '',
      whp: '',
      size_mm: '',
      brand_id: '',
      collection_id: '',
      warehouse_qty: '',
      tray_qty: '',
      total_qty: '',
      status: 'draft',
    });
  };

  const handleAdd = () => {
    resetForm();
    setOpenAdd(true);
  };

  const handleEdit = (row) => {
    const product = row.data;
    setFormData({
      model_no: product.model_no || '',
      gender_id: product.gender_id || '',
      color_code_id: product.color_code_id || '',
      shape_id: product.shape_id || '',
      lens_color_id: product.lens_color_id || '',
      frame_color_id: product.frame_color_id || '',
      frame_type_id: product.frame_type_id || '',
      lens_material_id: product.lens_material_id || '',
      frame_material_id: product.frame_material_id || '',
      mrp: product.mrp || '',
      whp: product.whp || '',
      size_mm: product.size_mm || '',
      brand_id: product.brand_id || '',
      collection_id: product.collection_id || '',
      warehouse_qty: product.warehouse_qty || '',
      tray_qty: product.tray_qty || '',
      total_qty: product.total_qty || '',
      status: product.status || 'draft',
    });
    setEditRow(row);
  };

  const handleDelete = async (row) => {
    const productId = row.id || row.product_id;
    if (!productId) {
      showError('Product ID is missing');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete product ${row.model_no}? This will also remove it from all trays.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, remove the product from all trays to avoid foreign key constraint error
      try {
        const allTrays = await getTrays();
        const removalPromises = [];

        for (const tray of allTrays || []) {
          const trayId = tray.tray_id || tray.id;
          if (!trayId) continue;

          try {
            // Get products in this tray
            const trayProducts = await getProductsInTray(trayId);
            
            // Check if this product exists in the tray
            const productInTray = Array.isArray(trayProducts) 
              ? trayProducts.find(tp => {
                  const tpProductId = tp.product_id || tp.product?.product_id || tp.product?.id;
                  return tpProductId && String(tpProductId).toLowerCase() === String(productId).toLowerCase();
                })
              : null;

            // If product exists in tray, remove it
            if (productInTray) {
              removalPromises.push(
                deleteProductFromTray({
                  tray_id: trayId,
                  product_id: productId,
                }).catch(err => {
                  console.warn(`Failed to remove product from tray ${trayId}:`, err);
                  // Continue with other trays even if one fails
                })
              );
            }
          } catch (err) {
            console.warn(`Error checking tray ${trayId}:`, err);
            // Continue with other trays
          }
        }

        // Wait for all removals to complete
        if (removalPromises.length > 0) {
          await Promise.all(removalPromises);
          console.log(`Removed product from ${removalPromises.length} tray(s)`);
        }
      } catch (trayError) {
        console.warn('Error removing product from trays:', trayError);
        // Continue with product deletion even if tray removal fails
        // The backend might handle cascade deletion
      }

      // Now delete the product
      await deleteProduct(productId);
      await fetchProducts();
      setError(null);
      showSuccess('Product deleted successfully');
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error deleting product:', error);
        
        // Check if it's a foreign key constraint error
        const errorMessage = error.message || JSON.stringify(error);
        if (errorMessage.includes('foreign key constraint') || errorMessage.includes('tray_product')) {
          const message = 'Cannot delete product: It is still assigned to one or more trays. Please remove it from all trays first.';
          setError(message);
          showError(message);
        } else {
          const message = `Failed to delete product: ${error.message}`;
          setError(message);
          showError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(() => ([
    { key: 'model_no', label: 'MODEL NO', width: '120px' },
    { key: 'gender_name', label: 'GENDER', width: '100px' },
    { key: 'color_code_name', label: 'COLOR CODE', width: '120px' },
    { key: 'shape_name', label: 'SHAPE', width: '120px' },
    { key: 'lens_color_name', label: 'LENS COLOR', width: '130px' },
    { key: 'frame_color_name', label: 'FRAME COLOR', width: '140px' },
    { key: 'frame_type_name', label: 'FRAME TYPE', width: '130px' },
    { key: 'lens_material_name', label: 'LENS MATERIAL', width: '150px' },
    { key: 'frame_material_name', label: 'FRAME MATERIAL', width: '160px' },
    { key: 'mrp_formatted', label: 'MRP', width: '100px' },
    { key: 'whp_formatted', label: 'WHP', width: '100px' },
    { key: 'size_mm', label: 'SIZE (MM)', width: '110px' },
    { key: 'warehouse_qty', label: 'WAREHOUSE QTY', width: '140px' },
    { key: 'tray_qty', label: 'TRAY QTY', width: '110px' },
    { key: 'total_qty', label: 'TOTAL QTY', width: '110px' },
    { key: 'status', label: 'STATUS', width: '100px' },
    { key: 'brand', label: 'BRAND', width: '120px' },
    { key: 'collection', label: 'COLLECTION', width: '130px' },
    { key: 'action', label: 'ACTION', width: '120px', render: (_v, row) => (
      <RowActions 
        onEdit={() => handleEdit(row)} 
        onDelete={() => handleDelete(row)} 
        onUpload={(!row.data?.image_url && activeTab === 'Unuploaded Media Gallery') 
          ? () => handleAttachImage(row) 
          : undefined}
      />
    ) },
  ]), [handleEdit, handleDelete, handleAttachImage, activeTab]);

  const handleOpenMediaUpload = () => {
    // Media gallery allows generic uploads (no product binding)
    setImageTargetProduct(null);
    setError(null);
    imageInputRef.current?.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const dataToSend = {
        model_no: formData.model_no,
        gender_id: parseInt(formData.gender_id) || 0,
        color_code_id: parseInt(formData.color_code_id) || 0,
        shape_id: parseInt(formData.shape_id) || 0,
        lens_color_id: parseInt(formData.lens_color_id) || 0,
        frame_color_id: parseInt(formData.frame_color_id) || 0,
        frame_type_id: parseInt(formData.frame_type_id) || 0,
        lens_material_id: parseInt(formData.lens_material_id) || 0,
        frame_material_id: parseInt(formData.frame_material_id) || 0,
        mrp: parseFloat(formData.mrp) || 0,
        whp: parseFloat(formData.whp) || 0,
        size_mm: formData.size_mm,
        brand_id: formData.brand_id,
        collection_id: formData.collection_id,
        warehouse_qty: parseInt(formData.warehouse_qty) || 0,
        status: formData.status,
      };
      
      // Include tray_qty and total_qty only when updating (edit mode)
      if (editRow) {
        dataToSend.tray_qty = parseInt(formData.tray_qty) || 0;
        dataToSend.total_qty = parseInt(formData.total_qty) || 0;
        await updateProduct(editRow.id, dataToSend);
        showSuccess('Product updated successfully');
      } else {
        await createProduct(dataToSend);
        showSuccess('Product created successfully');
      }
      
      await fetchProductsWithoutLoading();
      await fetchRelatedData();
      setError(null);
      setOpenAdd(false);
      setEditRow(null);
      resetForm();
    } catch (error) {
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        console.error('Error saving product:', error);
        const message = `Failed to save product: ${error.message}`;
        setError(message);
        showError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const targetProduct = imageTargetProduct;
    const targetProductId = targetProduct?.id 
      || targetProduct?.product_id 
      || targetProduct?.data?.product_id 
      || targetProduct?.data?.id;
    const targetLabel = targetProduct?.model_no 
      || targetProduct?.data?.model_no 
      || (activeTab === 'Media Gallery' ? 'media' : 'product');

    const isMediaUpload = activeTab === 'Media Gallery';

    if (!targetProductId && !isMediaUpload) {
      setError('Please pick a product to attach images to (use Upload action in Unuploaded Media Gallery).');
      if (e.target) {
        e.target.value = '';
      }
      return;
    }

    // Validate all files
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setError('Please select valid image files only');
      return;
    }

    // Validate file sizes (max 10MB each)
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Some images exceed 10MB size limit. Please select smaller files.');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);
      setSelectedImages(files);
      
      const response = await uploadProductImage(files, targetProductId);
      
      // Log full response for debugging
      console.log('Image upload response:', response);
      
      // If upload successful and uploaded to a specific product, update status to active and refresh
      if (targetProductId) {
        // Find the product to update its status
        const productToUpdate = products.find(p => 
          (p.id || p.product_id) == targetProductId
        ) || targetProduct?.data || targetProduct;
        
        if (productToUpdate) {
          // Update product status to active when image is uploaded
          const updateData = {
            model_no: productToUpdate.model_no || '',
            gender_id: parseInt(productToUpdate.gender_id) || 0,
            color_code_id: parseInt(productToUpdate.color_code_id) || 0,
            shape_id: parseInt(productToUpdate.shape_id) || 0,
            lens_color_id: parseInt(productToUpdate.lens_color_id) || 0,
            frame_color_id: parseInt(productToUpdate.frame_color_id) || 0,
            frame_type_id: parseInt(productToUpdate.frame_type_id) || 0,
            lens_material_id: parseInt(productToUpdate.lens_material_id) || 0,
            frame_material_id: parseInt(productToUpdate.frame_material_id) || 0,
            mrp: parseFloat(productToUpdate.mrp) || 0,
            whp: parseFloat(productToUpdate.whp) || 0,
            size_mm: productToUpdate.size_mm || '',
            brand_id: productToUpdate.brand_id || '',
            collection_id: productToUpdate.collection_id || '',
            warehouse_qty: parseInt(productToUpdate.warehouse_qty) || 0,
            tray_qty: parseInt(productToUpdate.tray_qty) || 0,
            total_qty: parseInt(productToUpdate.total_qty) || 0,
            status: 'active', // Update status to active when image is uploaded
            image_urls: productToUpdate.image_urls || [] // Keep existing image_urls
          };
          
          await updateProduct(targetProductId, updateData);
        }
        
        await fetchProductsWithoutLoading();
        await fetchRelatedData();
      }
      
      // Handle orphaned images (uploaded without product_id)
      if (isMediaUpload && !targetProductId) {
        // Refresh the media gallery to show the newly uploaded image immediately
        await fetchAllUploads();
        
        // Extract image paths from response - API returns { data: [{ path, filename, ... }] }
        let imageFiles = [];
        
        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Response has data array with file info
            imageFiles = response.data.map(item => {
              // Extract relative path from absolute server path
              const relativePath = extractRelativePath(item.path);
              return {
              filename: item.filename || item.originalName || item.name,
                path: relativePath, // Convert absolute path to relative path
                url: relativePath || item.image_url || item.url || null
              };
            });
          } else if (response.data.path || response.data.filename) {
            // Extract relative path from absolute server path
            const relativePath = extractRelativePath(response.data.path);
            imageFiles = [{
              filename: response.data.filename || response.data.originalName,
              path: relativePath, // Convert absolute path to relative path
              url: relativePath || response.data.image_url || response.data.url || null
            }];
          }
        }
        
        // If no files extracted from response, use uploaded file names
        if (imageFiles.length === 0 && files.length > 0) {
          // Get backend base URL for constructing image URLs
          const getBackendBaseUrl = () => {
            if (typeof window === 'undefined') return '';
            const envUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stallion.nishree.com/api';
            if (envUrl) {
              let backendUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
              if (backendUrl.endsWith('/api')) {
                backendUrl = backendUrl.slice(0, -4);
              }
              return backendUrl;
            }
            return 'https://stallion.nishree.com';
          };
          
          const backendBaseUrl = getBackendBaseUrl();
          imageFiles = files.map(file => ({
            filename: file.name,
            path: null,
            url: `${backendBaseUrl}/uploads/products/${file.name}`
          }));
        }
        
        // Add to orphaned images using path from API response
        if (imageFiles.length > 0) {
          const newOrphanedImages = imageFiles
            .filter(file => file && (file.path || file.filename))
            .map(file => {
              // Use path from API response (already converted to relative), or construct URL from filename
              const imageUrl = file.path || file.url || (file.filename ? `/uploads/products/${file.filename}` : null);
              
              return {
                url: imageUrl,
                image_url: imageUrl,
                filename: file.filename,
                uploadedAt: new Date().toISOString(),
                isTemporary: false,
                verified: !!file.path // Verified if we got path from API
              };
            });
          
          setOrphanedImages(prev => [...prev, ...newOrphanedImages]);
        }
      }
      
      const fileCount = files.length;
      setUploadProgress({
        success: true,
        message: fileCount === 1 
          ? (isMediaUpload ? 'Image uploaded successfully!' : `Image attached to ${targetLabel} successfully!`) 
          : (isMediaUpload ? `${fileCount} images uploaded successfully!` : `${fileCount} images attached to ${targetLabel} successfully!`),
      });
      showSuccess(isMediaUpload ? 'Images uploaded successfully' : 'Images attached to product successfully');
      
      // Close the modal if it was open
      if (openImageSelectModal) {
        setOpenImageSelectModal(false);
      }
      setImageTargetProduct(null);
      
      // Clear selection after 3 seconds
      setTimeout(() => {
        setSelectedImages([]);
        setUploadProgress(null);
        // Reset file input
        if (e.target) {
          e.target.value = '';
        }
      }, 3000);
    } catch (error) {
      console.error('Error uploading images:', error);
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        const message = `Failed to upload images: ${error.message}`;
        setError(message);
        showError(message);
      }
      setSelectedImages([]);
      // Reset file input on error
      if (e.target) {
        e.target.value = '';
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedBulkFile) {
      setError('Please select an Excel file to upload');
      return;
    }

    // Validate file type
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = selectedBulkFile.name.toLowerCase();
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidFile) {
      setError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    try {
      setUploadingBulk(true);
      setError(null);
      
      const response = await bulkUploadProducts(selectedBulkFile);
      
      // Show success message with details
      const successMessage = response.message || 'Bulk upload completed successfully!';
      const details = response.data ? 
        `Created: ${response.data.successCount || 0}, Errors: ${response.data.errorCount || 0}` : '';
      
      setUploadProgress({
        success: true,
        message: successMessage,
        details: details,
      });
      showSuccess(successMessage);
      
      // Refresh products list
      await fetchProductsWithoutLoading();
      await fetchRelatedData();
      
      // Clear selection and close modal after 3 seconds
      setTimeout(() => {
        setSelectedBulkFile(null);
        setUploadProgress(null);
        setOpenBulkUpload(false);
      }, 3000);
    } catch (error) {
      console.error('Error uploading bulk file:', error);
      if (!error.message?.toLowerCase().includes('token expired') && 
          !error.message?.toLowerCase().includes('unauthorized')) {
        const message = `Failed to upload file: ${error.message}`;
        setError(message);
        showError(message);
      }
    } finally {
      setUploadingBulk(false);
    }
  };

  const handleBulkFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedBulkFile(file);
      setError(null);
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        {error && (
          <div className="dash-row">
            <div className="dash-card full">
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#fee', 
                border: '1px solid #fcc', 
                borderRadius: '8px',
                color: '#c33',
                marginBottom: '16px'
              }}>
                <strong>Error:</strong> {error}
                <button 
                  onClick={() => setError(null)}
                  style={{
                    float: 'right',
                    background: 'none',
                    border: 'none',
                    color: '#c33',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="dash-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="order-tabs-container">
            {['Products', 'Media Gallery', 'Unuploaded Media Gallery'].map(tab => (
              <button
                key={tab}
                className={`order-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {activeTab === 'Media Gallery' && (
            <button
              className="ui-btn ui-btn--primary"
              onClick={handleOpenMediaUpload}
              disabled={uploadingImage}
              style={{ whiteSpace: 'nowrap', padding: '10px 16px' }}
            >
              {uploadingImage ? 'Uploading...' : 'Upload Images'}
            </button>
          )}
        </div>
        {uploadProgress && (
          <div className="dash-row">
            <div className="dash-card full">
              <div style={{ 
                padding: '12px',
                backgroundColor: uploadProgress.success ? '#d4edda' : '#f8d7da',
                border: `1px solid ${uploadProgress.success ? '#c3e6cb' : '#f5c6cb'}`,
                borderRadius: '8px',
                color: uploadProgress.success ? '#155724' : '#721c24'
              }}>
                <strong>{uploadProgress.success ? 'Success:' : 'Error:'}</strong> {uploadProgress.message}
                {uploadProgress.details && (
                  <div style={{ marginTop: '6px', fontSize: '14px' }}>
                    {uploadProgress.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="dash-row">
          <div className="dash-card full">
            {activeTab === 'Media Gallery' ? (
              <div>
                {loading ? (
                  <LoadingSpinner />
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '20px',
                      padding: '20px'
                    }}
                  >
                    {allMediaImages.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#666', padding: '40px' }}>
                        No uploaded images found.
                      </div>
                    )}
                    {allMediaImages.map(item => (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                      }}
                    >
                      {/* Status Tag - Always show assigned/unassigned status */}
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: (item.type === 'assigned') ? '#4caf50' : '#ff9800',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        zIndex: 2,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}>
                        {item.type === 'assigned' ? 'Assigned' : 'Unassigned'}
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: '#f44336',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '36px',
                          height: '36px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          fontSize: '18px',
                          fontWeight: 'bold',
                          transition: 'background 0.2s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Are you sure you want to delete this ${item.type === 'assigned' ? 'assigned' : 'unassigned'} image?`)) {
                            return;
                          }

                          try {
                            setLoading(true);
                            
                            if (item.type === 'assigned') {
                              // For assigned images, update the product to remove the image_url from database
                              const product = item.productData;
                              if (product && item.productId) {
                                // Update product via API (without image_url since API doesn't support it)
                                await updateProduct(item.productId, {
                                  model_no: product.model_no,
                                  gender_id: product.gender_id || 0,
                                  color_code_id: product.color_code_id || 0,
                                  shape_id: product.shape_id || 0,
                                  lens_color_id: product.lens_color_id || 0,
                                  frame_color_id: product.frame_color_id || 0,
                                  frame_type_id: product.frame_type_id || 0,
                                  lens_material_id: product.lens_material_id || 0,
                                  frame_material_id: product.frame_material_id || 0,
                                  mrp: product.mrp || 0,
                                  whp: product.whp || 0,
                                  size_mm: product.size_mm || '',
                                  brand_id: product.brand_id,
                                  collection_id: product.collection_id,
                                  warehouse_qty: product.warehouse_qty || 0,
                                  tray_qty: product.tray_qty || 0,
                                  total_qty: product.total_qty || 0,
                                  status: product.status || 'draft'
                                });
                                
                                showSuccess('Product updated successfully');
                                await fetchProductsWithoutLoading();
                                await fetchRelatedData();
                              }
                            } else {
                              // For unassigned images, remove from state and mark URL as invalid
                              const imageUrl = item.image_url;
                              setInvalidImageUrls(prev => new Set([...prev, imageUrl]));
                              setOrphanedImages(prev => prev.filter(img => {
                                const imgUrl = img.url || img.image_url;
                                return imgUrl !== imageUrl && img.originalData !== item.originalData;
                              }));
                              showSuccess('Unassigned image removed successfully');
                            }
                          } catch (error) {
                            console.error('Error deleting image:', error);
                            showError(`Failed to delete image: ${error.message}`);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#d32f2f';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f44336';
                        }}
                        disabled={loading}
                        aria-label="Delete image"
                        title="Delete image"
                      >
                        ✕
                      </button>
                      
                      {/* Image Container */}
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '4/3', 
                        background: '#f5f5f5', 
                        position: 'relative',
                        minHeight: '250px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.model_no || 'Product image'}
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain', // Changed from 'cover' to 'contain' to show full image
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: '100%'
                            }}
                            onError={(e) => {
                              const img = e.target;
                              const normalizedUrl = item.image_url;
                              const originalUrl = item.originalImageUrl;
                              
                              console.error('Image failed to load:', normalizedUrl);
                              
                              // If we have an original URL that's different, try it as fallback
                              if (originalUrl && originalUrl !== normalizedUrl && !img.dataset.fallbackTried) {
                                console.log('Trying original URL as fallback:', originalUrl);
                                img.dataset.fallbackTried = 'true';
                                // Construct full URL from original if needed
                                let fallbackUrl = originalUrl;
                                if (!originalUrl.startsWith('http://') && !originalUrl.startsWith('https://') && !originalUrl.startsWith('blob:')) {
                                  const getImageBase = () => {
                                    if (typeof window === 'undefined') return '';
                                    const imgEnv = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || '';
                                    if (imgEnv) return imgEnv.replace(/\/$/, '');
                                    const apiEnv = process.env.NEXT_PUBLIC_API_URL || '';
                                    if (apiEnv) return apiEnv.replace(/\/api\/?$/, '').replace(/\/$/, '');
                                    return 'https://stallion.nishree.com';
                                  };
                                  const base = getImageBase();
                                  fallbackUrl = originalUrl.startsWith('/') ? `${base}${originalUrl}` : `${base}/uploads/products/${originalUrl}`;
                                }
                                img.src = fallbackUrl;
                                return; // Don't mark as invalid yet, wait for fallback to fail
                              }
                              
                              // Both normalized and original URLs failed, mark as invalid
                              setInvalidImageUrls(prev => new Set([...prev, normalizedUrl]));
                              if (originalUrl && originalUrl !== normalizedUrl) {
                                setInvalidImageUrls(prev => new Set([...prev, originalUrl]));
                              }
                              
                              img.style.display = 'none';
                              const errorDiv = img.nextElementSibling;
                              if (errorDiv) {
                                errorDiv.style.display = 'flex';
                                errorDiv.textContent = item.isTemporary 
                                  ? 'Image uploading...' 
                                  : 'Image not found';
                              }
                              // Remove from orphaned images if it's unassigned and failed to load
                              if (item.type === 'unassigned') {
                                setOrphanedImages(prev => prev.filter(img => {
                                  const imgUrl = img.url || img.image_url;
                                  return imgUrl !== normalizedUrl && imgUrl !== originalUrl;
                                }));
                              }
                            }}
                            onLoad={() => {
                              const errorDiv = document.querySelector(`[data-image-error="${item.id}"]`);
                              if (errorDiv) {
                                errorDiv.style.display = 'none';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          data-image-error={item.id}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: item.image_url ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#999',
                            fontSize: '14px',
                            position: 'absolute',
                            top: 0,
                            left: 0
                          }}
                        >
                          {item.isTemporary ? 'Loading...' : 'No Image'}
                        </div>
                      </div>
                      
                    </div>
                  ))}
                  </div>
                )}
              </div>
            ) : (
            <TableWithControls
              title={activeTab === 'Unuploaded Media Gallery' ? 'Unuploaded Media Gallery' : 'Products'}
              columns={columns}
              rows={filteredRowsByTab}
              onAddNew={activeTab === 'Unuploaded Media Gallery' ? null : handleAdd}
              addNewText="Add New Product"
              onImport={activeTab === 'Unuploaded Media Gallery' ? null : () => setOpenBulkUpload(true)}
              importText="Bulk Upload Products"
              secondaryActions={[]}
              searchPlaceholder="Search products"
              loading={loading}
            />
            )}
          </div>
        </div>
      </div>
      <Modal
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          resetForm();
        }}
        title="Add New Product"
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setOpenAdd(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      >
        <form className="ui-form" onSubmit={handleSubmit}>
          <div className="form-group form-group--full">
            <label className="ui-label">Model No *</label>
            <input
              className="ui-input"
              placeholder="Enter model number"
              value={formData.model_no}
              onChange={(e) => handleInputChange('model_no', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Brand *</label>
            <DropdownSelector
              options={brands.map(b => ({ 
                value: b.brand_id || b.id, 
                label: b.brand_name 
              }))}
              value={formData.brand_id}
              onChange={(value) => handleInputChange('brand_id', value)}
              placeholder="Select brand"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Collection *</label>
            <DropdownSelector
              options={collections.map(c => ({ 
                value: c.collection_id || c.id, 
                label: c.collection_name 
              }))}
              value={formData.collection_id}
              onChange={(value) => handleInputChange('collection_id', value)}
              placeholder="Select collection"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Gender *</label>
            <DropdownSelector
              options={genders.map(g => ({ 
                value: g.gender_id || g.id, 
                label: g.gender_name 
              }))}
              value={formData.gender_id}
              onChange={(value) => handleInputChange('gender_id', value)}
              placeholder="Select gender"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Color Code *</label>
            <DropdownSelector
              options={colorCodes.map(c => ({ 
                value: c.color_code_id || c.id, 
                label: c.color_code 
              }))}
              value={formData.color_code_id}
              onChange={(value) => handleInputChange('color_code_id', value)}
              placeholder="Select color code"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Shape *</label>
            <DropdownSelector
              options={shapes.map(s => ({ 
                value: s.shape_id || s.id, 
                label: s.shape_name 
              }))}
              value={formData.shape_id}
              onChange={(value) => handleInputChange('shape_id', value)}
              placeholder="Select shape"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Lens Color *</label>
            <DropdownSelector
              options={lensColors.map(l => ({ 
                value: l.lens_color_id || l.id, 
                label: l.lens_color 
              }))}
              value={formData.lens_color_id}
              onChange={(value) => handleInputChange('lens_color_id', value)}
              placeholder="Select lens color"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Color *</label>
            <DropdownSelector
              options={frameColors.map(f => ({ 
                value: f.frame_color_id || f.id, 
                label: f.frame_color 
              }))}
              value={formData.frame_color_id}
              onChange={(value) => handleInputChange('frame_color_id', value)}
              placeholder="Select frame color"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Type *</label>
            <DropdownSelector
              options={frameTypes.map(f => ({ 
                value: f.frame_type_id || f.id, 
                label: f.frame_type 
              }))}
              value={formData.frame_type_id}
              onChange={(value) => handleInputChange('frame_type_id', value)}
              placeholder="Select frame type"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Lens Material *</label>
            <DropdownSelector
              options={lensMaterials.map(l => ({ 
                value: l.lens_material_id || l.id, 
                label: l.lens_material 
              }))}
              value={formData.lens_material_id}
              onChange={(value) => handleInputChange('lens_material_id', value)}
              placeholder="Select lens material"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Material *</label>
            <DropdownSelector
              options={frameMaterials.map(f => ({ 
                value: f.frame_material_id || f.id, 
                label: f.frame_material 
              }))}
              value={formData.frame_material_id}
              onChange={(value) => handleInputChange('frame_material_id', value)}
              placeholder="Select frame material"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">MRP *</label>
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Enter MRP"
              value={formData.mrp}
              onChange={(e) => handleInputChange('mrp', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">WHP *</label>
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Enter WHP"
              value={formData.whp}
              onChange={(e) => handleInputChange('whp', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Size (mm) *</label>
            <input
              className="ui-input"
              placeholder="Enter size in mm"
              value={formData.size_mm}
              onChange={(e) => handleInputChange('size_mm', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Warehouse Qty *</label>
            <input
              className="ui-input"
              type="number"
              placeholder="Enter warehouse quantity"
              value={formData.warehouse_qty}
              onChange={(e) => handleInputChange('warehouse_qty', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Status *</label>
            <DropdownSelector
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              value={formData.status}
              onChange={(value) => handleInputChange('status', value)}
              placeholder="Select status"
            />
        </div>
        </form>
      </Modal>
      <Modal
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
        }}
        title="Edit Product"
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setEditRow(null);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </>
        )}
      >
        <form className="ui-form" onSubmit={handleSubmit}>
          <div className="form-group form-group--full">
            <label className="ui-label">Model No *</label>
            <input
              className="ui-input"
              placeholder="Enter model number"
              value={formData.model_no}
              onChange={(e) => handleInputChange('model_no', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Brand *</label>
            <DropdownSelector
              options={brands.map(b => ({ 
                value: b.brand_id || b.id, 
                label: b.brand_name 
              }))}
              value={formData.brand_id}
              onChange={(value) => handleInputChange('brand_id', value)}
              placeholder="Select brand"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Collection *</label>
            <DropdownSelector
              options={collections.map(c => ({ 
                value: c.collection_id || c.id, 
                label: c.collection_name 
              }))}
              value={formData.collection_id}
              onChange={(value) => handleInputChange('collection_id', value)}
              placeholder="Select collection"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Gender *</label>
            <DropdownSelector
              options={genders.map(g => ({ 
                value: g.gender_id || g.id, 
                label: g.gender_name 
              }))}
              value={formData.gender_id}
              onChange={(value) => handleInputChange('gender_id', value)}
              placeholder="Select gender"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Color Code *</label>
            <DropdownSelector
              options={colorCodes.map(c => ({ 
                value: c.color_code_id || c.id, 
                label: c.color_code 
              }))}
              value={formData.color_code_id}
              onChange={(value) => handleInputChange('color_code_id', value)}
              placeholder="Select color code"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Shape *</label>
            <DropdownSelector
              options={shapes.map(s => ({ 
                value: s.shape_id || s.id, 
                label: s.shape_name 
              }))}
              value={formData.shape_id}
              onChange={(value) => handleInputChange('shape_id', value)}
              placeholder="Select shape"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Lens Color *</label>
            <DropdownSelector
              options={lensColors.map(l => ({ 
                value: l.lens_color_id || l.id, 
                label: l.lens_color 
              }))}
              value={formData.lens_color_id}
              onChange={(value) => handleInputChange('lens_color_id', value)}
              placeholder="Select lens color"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Color *</label>
            <DropdownSelector
              options={frameColors.map(f => ({ 
                value: f.frame_color_id || f.id, 
                label: f.frame_color 
              }))}
              value={formData.frame_color_id}
              onChange={(value) => handleInputChange('frame_color_id', value)}
              placeholder="Select frame color"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Type *</label>
            <DropdownSelector
              options={frameTypes.map(f => ({ 
                value: f.frame_type_id || f.id, 
                label: f.frame_type 
              }))}
              value={formData.frame_type_id}
              onChange={(value) => handleInputChange('frame_type_id', value)}
              placeholder="Select frame type"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Lens Material *</label>
            <DropdownSelector
              options={lensMaterials.map(l => ({ 
                value: l.lens_material_id || l.id, 
                label: l.lens_material 
              }))}
              value={formData.lens_material_id}
              onChange={(value) => handleInputChange('lens_material_id', value)}
              placeholder="Select lens material"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Frame Material *</label>
            <DropdownSelector
              options={frameMaterials.map(f => ({ 
                value: f.frame_material_id || f.id, 
                label: f.frame_material 
              }))}
              value={formData.frame_material_id}
              onChange={(value) => handleInputChange('frame_material_id', value)}
              placeholder="Select frame material"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">MRP *</label>
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Enter MRP"
              value={formData.mrp}
              onChange={(e) => handleInputChange('mrp', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">WHP *</label>
            <input
              className="ui-input"
              type="number"
              step="0.01"
              placeholder="Enter WHP"
              value={formData.whp}
              onChange={(e) => handleInputChange('whp', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Size (mm) *</label>
            <input
              className="ui-input"
              placeholder="Enter size in mm"
              value={formData.size_mm}
              onChange={(e) => handleInputChange('size_mm', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Warehouse Qty *</label>
            <input
              className="ui-input"
              type="number"
              placeholder="Enter warehouse quantity"
              value={formData.warehouse_qty}
              onChange={(e) => handleInputChange('warehouse_qty', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full">
            <label className="ui-label">Status *</label>
            <DropdownSelector
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' }
              ]}
              value={formData.status}
              onChange={(value) => handleInputChange('status', value)}
              placeholder="Select status"
            />
          </div>
        </form>
      </Modal>
      <Modal
        open={openBulkUpload}
        onClose={() => {
          setOpenBulkUpload(false);
          setSelectedBulkFile(null);
          setError(null);
          setUploadProgress(null);
        }}
        title="Bulk Upload Products"
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setOpenBulkUpload(false);
                setSelectedBulkFile(null);
                setError(null);
                setUploadProgress(null);
              }}
              disabled={uploadingBulk}
            >
              Cancel
            </button>
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={handleBulkUpload}
              disabled={uploadingBulk || !selectedBulkFile}
            >
              {uploadingBulk ? 'Uploading...' : 'Upload File'}
            </button>
          </>
        )}
      >
        <div className="ui-form">
          <div className="form-group form-group--full">
            <label className="ui-label">Select Excel File (.xlsx or .xls) *</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleBulkFileSelect}
              className="ui-input"
              disabled={uploadingBulk}
            />
            {selectedBulkFile && (
              <p style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
                Selected: {selectedBulkFile.name} ({(selectedBulkFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
          {uploadProgress && (
            <div style={{
              padding: '12px',
              backgroundColor: uploadProgress.success ? '#d4edda' : '#f8d7da',
              border: `1px solid ${uploadProgress.success ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '8px',
              marginTop: '16px',
              color: uploadProgress.success ? '#155724' : '#721c24'
            }}>
              <strong>{uploadProgress.success ? 'Success!' : 'Error:'}</strong> {uploadProgress.message}
              {uploadProgress.details && (
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  {uploadProgress.details}
                </div>
              )}
          </div>
          )}
        </div>
      </Modal>
      <Modal
        open={openImageSelectModal}
        onClose={() => {
          setOpenImageSelectModal(false);
          setImageTargetProduct(null);
          setError(null);
          setSelectedImageIds(new Set());
        }}
        title={`Attach Image to Product: ${imageTargetProduct?.model_no || imageTargetProduct?.data?.model_no || ''}`}
        footer={(
          <>
            <button 
              className="ui-btn ui-btn--secondary" 
              onClick={() => {
                setOpenImageSelectModal(false);
                setImageTargetProduct(null);
                setError(null);
                setSelectedImageIds(new Set());
              }}
              disabled={loading}
            >
              Cancel
            </button>
            {selectedImageIds.size > 0 && (
              <button 
                className="ui-btn ui-btn--primary" 
                onClick={handleAttachMultipleImages}
                disabled={loading || uploadingImage}
              >
                {loading ? 'Attaching...' : `Attach Selected (${selectedImageIds.size})`}
              </button>
            )}
            <button 
              className="ui-btn ui-btn--primary" 
              onClick={() => {
                imageInputRef.current?.click();
              }}
              disabled={loading || uploadingImage}
            >
              Upload New Image
            </button>
          </>
        )}
      >
        <div style={{ padding: '16px' }}>
          {availableImagesForModal.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>No unassigned images available.</p>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                Click "Upload New Image" to upload an image for this product.
              </p>
            </div>
          ) : (
            <>
              <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
                Select one or more images from the gallery below to attach to this product. Click on images to select/deselect them, then click "Attach Selected" to assign them all at once. You can also upload a new image.
              </p>
              {selectedImageIds.size > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: '#eff6ff',
                  border: '1px solid #3b82f6',
                  borderRadius: '8px',
                  color: '#1e40af',
                  fontSize: '14px'
                }}>
                  <strong>{selectedImageIds.size}</strong> image{selectedImageIds.size > 1 ? 's' : ''} selected. Click "Attach Selected" to assign them to this product.
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '16px',
                  maxHeight: '500px',
                  overflowY: 'auto',
                  padding: '8px'
                }}
              >
                {availableImagesForModal.map(item => {
                  const isSelected = selectedImageIds.has(item.id);
                  return (
                  <div
                    key={item.id}
                    style={{
                      border: isSelected ? '3px solid #3b82f6' : '2px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    onClick={(e) => {
                      // Toggle selection on click
                      setSelectedImageIds(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(item.id)) {
                          newSet.delete(item.id);
                        } else {
                          newSet.add(item.id);
                        }
                        return newSet;
                      });
                    }}
                  >
                    {/* Checkbox for selection */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      zIndex: 3,
                      background: isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)',
                      border: '2px solid #3b82f6',
                      borderRadius: '4px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}>
                      {isSelected && (
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                    <div style={{ width: '100%', aspectRatio: '4/3', background: '#f5f5f5', position: 'relative' }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.model_no || 'Unassigned image'}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            display: 'block'
                          }}
                          onError={(e) => {
                            // Mark this image URL as invalid
                            setInvalidImageUrls(prev => new Set([...prev, item.image_url]));
                            e.target.style.display = 'none';
                            const errorDiv = e.target.nextElementSibling;
                            if (errorDiv) {
                              errorDiv.style.display = 'flex';
                            }
                          }}
                          onLoad={() => {
                            // Image loaded successfully, ensure it's not marked as invalid
                            setInvalidImageUrls(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(item.image_url);
                              return newSet;
                            });
                          }}
                        />
                      ) : null}
                      <div 
                        style={{
                          width: '100%',
                          height: '100%',
                          display: item.image_url ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: '12px',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}
                      >
                        No Image
                      </div>
                    </div>
                    <div style={{ 
                      padding: '8px', 
                      background: '#ff9800', 
                      color: '#fff', 
                      fontSize: '11px', 
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      Unassigned
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0, 0, 0, 0.6)',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      pointerEvents: 'none'
                    }}>
                      {isSelected ? 'Selected' : 'Click to Select'}
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Modal>
      <input
        ref={imageInputRef}
        id="product-image-upload"
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        style={{ display: 'none' }}
        disabled={uploadingImage}
      />
    </div>
  );
};

export default DashboardProducts;

