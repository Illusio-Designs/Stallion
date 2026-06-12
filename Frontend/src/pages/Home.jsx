import React, { useState, useEffect } from 'react';
import '../styles/pages/Home.css';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/ui/Skeleton';
import { getFeaturedProducts, getCollections } from '../services/apiService';
import { isLoggedIn } from '../services/authService';
import { productPath } from '../utils/dashboardRoutes';

const Home = ({ onPageChange }) => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedFaq, setExpandedFaq] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  const handleFilterClick = (filterId) => {
    setActiveFilter(filterId);
  };

  const handleViewMore = (productId, modelNo) => {
    if (typeof window === 'undefined') return;
    // Clean product route: /product/<model_no>
    const target = productPath(modelNo);
    // Product detail requires auth — send to login with the product as returnUrl.
    if (!isLoggedIn()) {
      window.location.href = `/login?returnUrl=${encodeURIComponent(target)}`;
      return;
    }
    window.location.href = target;
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  // Fetch collections on component mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setLoadingCollections(true);
        const collectionsData = await getCollections();
        // Handle both array response and object with data property
        const collectionsArray = Array.isArray(collectionsData) ? collectionsData : (collectionsData?.data || []);
        setCollections(collectionsArray);
      } catch (error) {
        console.error('Error fetching collections:', error);
        setCollections([]);
      } finally {
        setLoadingCollections(false);
      }
    };

    fetchCollections();
  }, []);

  // Fetch featured products when activeFilter changes
  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setLoadingProducts(true);
        // Use "all" if activeFilter is "ALL", otherwise use the collection_id
        const collectionId = activeFilter === 'ALL' ? 'all' : activeFilter;
        const products = await getFeaturedProducts(collectionId);
        // Handle both array response and object with data property
        const productsArray = Array.isArray(products) ? products : (products?.data || []);
        
        // Filter out draft products (case-insensitive)
        // Only show products with status 'active' or 'published'
        const activeProducts = productsArray.filter(product => {
          const status = (product.status || '').toLowerCase().trim();
          return status === 'active' || status === 'published';
        });
        
        console.log('Featured products received:', productsArray.length);
        console.log('Active products after filtering:', activeProducts.length);
        
        setFeaturedProducts(activeProducts);
      } catch (error) {
        console.error('Error fetching featured products:', error);
        setFeaturedProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchFeaturedProducts();
  }, [activeFilter]);

  const faqs = [
    {
      question: "What is your minimum order quantity (MOQ)?",
      answer: "We typically supply bulk orders starting from 500 units, but requirements may vary by product category."
    },
    {
      question: "Do you offer bulk pricing or distributor discounts?",
      answer: "Yes, we provide competitive pricing for bulk orders and special discounts for distributors."
    },
    {
      question: "Can we customize goggles with our company logo or specific requirements?",
      answer: "Absolutely! We offer customization services including logo printing and specific design requirements."
    },
    {
      question: "How do you handle large-scale procurement contracts?",
      answer: "We have dedicated teams to manage large-scale contracts with flexible payment terms and delivery schedules."
    },
    {
      question: "Can we request product samples before placing a bulk order?",
      answer: "Yes, we can provide product samples for evaluation before you commit to a bulk order."
    }
  ];

  // Build filters array: "ALL" + the first 5 collections (6 chips total).
  // Home is a teaser — the full list lives on the Shop page via "VIEW ALL".
  const filters = [
    { id: 'ALL', name: 'ALL' },
    ...collections.slice(0, 5).map(collection => ({
      id: collection.collection_id || collection.id,
      name: collection.collection_name || 'Unnamed Collection'
    }))
  ];

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-background">
          <img src="/images/banners/hero background.webp" alt="Hero Background" className="hero-bg-image" />
        </div>
        <div className="hero-left-image">
          <img src="/images/banners/spacs.webp" alt="Eyewear" className="hero-side-image" />
        </div>
        <div className="hero-content">
          <h1>Bulk Safety Goggles Supply For Industries &amp; Enterprises</h1>
          <p>Certified eye protection solutions for businesses, delivered at scale with competitive pricing and reliable supply chain support.</p>
          <button
            type="button"
            className="cta-button"
            onClick={() => onPageChange ? onPageChange('products') : (window.location.href = '/products')}
          >
            Shop Now
          </button>
        </div>
        <div className="banner-slider">
        <div className="infinite-slider">
          <div className="slider-track">
            <img src="/images/banners/hero1.webp" alt="Eyewear Collection 1" className="slider-image" />
            <img src="/images/banners/hero2.webp" alt="Eyewear Collection 2" className="slider-image" />
            <img src="/images/banners/hero3.webp" alt="Eyewear Collection 3" className="slider-image" />
            <img src="/images/banners/hero4.webp" alt="Eyewear Collection 4" className="slider-image" />
            <img src="/images/banners/hero5.webp" alt="Eyewear Collection 5" className="slider-image" />
            {/* Duplicate for seamless loop */}
            <img src="/images/banners/hero1.webp" alt="Eyewear Collection 1" className="slider-image" />
            <img src="/images/banners/hero2.webp" alt="Eyewear Collection 2" className="slider-image" />
            <img src="/images/banners/hero3.webp" alt="Eyewear Collection 3" className="slider-image" />
            <img src="/images/banners/hero4.webp" alt="Eyewear Collection 4" className="slider-image" />
            <img src="/images/banners/hero5.webp" alt="Eyewear Collection 5" className="slider-image" />
          </div>
        </div>
      </div>
      </div>

      {/* Our Collection Section */}
      <section className="collection-section">
        <div className="collection-header">
          <h2>Our Collection</h2>
          <button type="button" className="view-all-button" onClick={() => onPageChange ? onPageChange('products') : (window.location.href = '/products')}>
            VIEW ALL
            <div className="arrow-with-star">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>

        <div className="collection-filters">
          {loadingCollections ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`filter-skeleton-${i}`} width={96} height={36} radius={18} style={{ marginRight: 8 }} />
            ))
          ) : (
            filters.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                aria-pressed={activeFilter === filter.id}
                onClick={() => handleFilterClick(filter.id)}
              >
                {filter.name}
              </button>
            ))
          )}
        </div>

        <div className="products-grid">
          {loadingProducts ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={`home-product-skeleton-${i}`} style={{ padding: 8 }}>
                <Skeleton width="100%" height={180} radius={12} />
                <Skeleton width="70%" height={16} style={{ marginTop: 12, display: 'block' }} />
                <Skeleton width="40%" height={14} style={{ marginTop: 8, display: 'block' }} />
              </div>
            ))
          ) : featuredProducts.length > 0 ? (
            featuredProducts.map((product) => {
              // Parse image_urls - handle both array and JSON string formats
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
                    
                    // Handle double-encoded strings
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
              
              // Get first image from image_urls
              const imageUrls = parseImageUrls(product.image_urls);
              let productImage = null;
              
              if (imageUrls && imageUrls.length > 0) {
                productImage = imageUrls[0];
              } else if (product.image_url) {
                // Fallback to image_url if image_urls is not available
                productImage = product.image_url;
              }
              
              // ProductCard will handle URL construction, so just pass the path
              const fullImageUrl = productImage || '/images/products/spac1.webp';
              
              // Use model_no as product name, or a default name
              const productName = product.model_no || 'Safety Goggles';
              
              // Use product_id as the identifier
              const productId = product.product_id || product.id;

              return (
                <ProductCard
                  key={productId}
                  productId={productId}
                  productName={productName}
                  productImage={fullImageUrl}
                  whp={product.whp}
                  mrp={product.mrp}
                  onViewMore={handleViewMore}
                />
              );
            })
          ) : (
            <div className="ui-state ui-state--empty home-products-empty">
              <div className="ui-state__icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M3 7l9 4 9-4M12 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="ui-state__title">No products in this collection yet</p>
              <p className="ui-state__desc">Try another collection or browse the full catalogue.</p>
            </div>
          )}
        </div>
      </section>

      {/* About Us Section */}
      <section className="about-section">
        <div className="about-container">
          <div className="about-image">
            <img src="/images/banners/hero3.webp" alt="About Us" />
            <div className="about-image-overlay"></div>
          </div>
          <div className="about-content">
            <div className="about-goggles-icon">
              <img src="/images/banners/spacs.webp" alt="Goggles" />
            </div>
            <h2>About Us</h2>
            <p>
              At Stallion, we specialize in providing high-quality safety goggles designed for industrial, corporate, and institutional use. Our focus is not retail sales, but long-term B2B partnerships with organizations that prioritize workforce safety and compliance.
            </p>
            <p>
              With years of expertise in manufacturing and global distribution, we supply goggles that meet international safety standards such as ANSI, EN166, and ISI. From manufacturing plants and construction sites to laboratories and healthcare facilities, our products are trusted by industries worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Our B2B Advantage Section */}
      <section className="b2b-advantage-section">
        <h2 className="b2b-advantage-title">Our B2B Advantage</h2>
        <div className="b2b-advantage-container">
          <div className="b2b-advantage-card">
            <div className="b2b-icon">
              <img src="/images/icons/package.webp" alt="Package" />
            </div>
            <h3>Bulk Order Fulfilment</h3>
          </div>
          <div className="b2b-advantage-card">
            <div className="b2b-icon">
              <img src="/images/icons/bank-note-01.webp" alt="Bank Note" />
            </div>
            <h3>Competitive Pricing</h3>
          </div>
          <div className="b2b-advantage-card">
            <div className="b2b-icon">
              <img src="/images/icons/globe-01.webp" alt="Globe" />
            </div>
            <h3>Global Shipping</h3>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq-section">
        <h2 className="faq-title">FAQs</h2>
        <div className="faq-container">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button
                type="button"
                className="faq-question"
                aria-expanded={expandedFaq === index}
                aria-controls={`faq-answer-${index}`}
                onClick={() => toggleFaq(index)}
              >
                <span className="faq-question-content">
                  <span className="faq-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="faq-question-text">{faq.question}</span>
                </span>
                <span className="faq-toggle" aria-hidden="true">
                  {expandedFaq === index ? '−' : '+'}
                </span>
              </button>
              {expandedFaq === index && (
                <div className="faq-answer" id={`faq-answer-${index}`} role="region">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
     
    </div>
  );
};

export default Home;


