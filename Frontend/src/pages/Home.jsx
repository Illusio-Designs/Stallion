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
      <div className="hero-section relative flex min-h-[calc(100vh+200px)] flex-col items-center justify-center overflow-hidden bg-primary-active pb-16 pt-[var(--header-height)] mt-[calc(var(--header-height)*-1)]">
        <div className="hero-background absolute inset-0 z-[1]">
          <img src="/images/banners/hero background.webp" alt="Hero Background" className="hero-bg-image block h-full w-full object-cover" />
        </div>
        <div className="hero-left-image pointer-events-none absolute left-0 top-2/5 z-[2] -translate-y-1/2">
          <img src="/images/banners/spacs.webp" alt="Eyewear" className="hero-side-image relative left-[-33px] h-auto w-[200px] rotate-[-20deg] object-contain opacity-[0.18] lg:w-[160px] lg:left-[-16px] max-[426px]:w-[140px]" />
        </div>
        <div className="hero-content relative z-[2] box-border w-full max-w-[900px] px-5 pb-16 pt-[calc(var(--header-height)+var(--space-8))] text-center text-text-on-primary lg:max-w-[760px] lg:px-5 lg:pb-12 lg:pt-16">
          <h1 className="mb-5 text-[length:clamp(2rem,5vw,3.5rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text-on-primary">Bulk Safety Goggles Supply For Industries &amp; Enterprises</h1>
          <p className="mx-auto mb-8 max-w-[680px] text-[length:clamp(1rem,2vw,1.25rem)] leading-[1.5] text-white/80">Certified eye protection solutions for businesses, delivered at scale with competitive pricing and reliable supply chain support.</p>
          <button
            type="button"
            className="cta-button inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-md bg-accent px-8 py-3 text-[length:var(--text-md)] font-semibold tracking-[0.02em] text-text-on-accent shadow-sm transition duration-200 ease-[ease] hover:bg-accent-hover hover:shadow-md focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none active:scale-[0.98]"
            onClick={() => onPageChange ? onPageChange('products') : (window.location.href = '/products')}
          >
            Shop Now
          </button>
        </div>
        <div className="banner-slider relative w-full overflow-hidden bg-primary-active pb-10">
        <div className="infinite-slider relative z-[2] w-full overflow-hidden">
          <div className="slider-track flex gap-5">
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
      <section className="collection-section bg-primary-active px-[6%] py-16 max-[426px]:px-5">
        <div className="collection-header mx-auto mb-10 flex max-w-[1400px] items-center justify-between gap-5 max-[426px]:flex-col max-[426px]:items-start">
          <h2 className="m-0 text-[length:clamp(2rem,4vw,3rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text-on-primary">Our Collection</h2>
          <button type="button" className="view-all-button group inline-flex cursor-pointer items-center gap-3 whitespace-nowrap rounded-md border-none bg-transparent px-2 py-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-on-primary transition duration-200 ease-[ease] hover:text-accent focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)] focus-visible:outline-none active:scale-[0.98] max-[384px]:gap-2" onClick={() => onPageChange ? onPageChange('products') : (window.location.href = '/products')}>
            VIEW ALL
            <div className="arrow-with-star flex h-10 w-10 items-center justify-center transition duration-200 ease-[ease] group-hover:translate-x-[3px] max-[384px]:h-9 max-[384px]:w-9">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-[2] text-accent">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>
        </div>

        <div className="collection-filters mx-auto mb-12 flex max-w-[1400px] flex-wrap justify-start gap-x-8 gap-y-2 overflow-x-auto overflow-y-hidden pb-3 max-[384px]:gap-x-5">
          {loadingCollections ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`filter-skeleton-${i}`} width={96} height={36} radius={18} style={{ marginRight: 8 }} />
            ))
          ) : (
            filters.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={`filter-btn relative min-h-[40px] cursor-pointer whitespace-nowrap border-b-2 border-transparent bg-transparent px-1 py-2 text-[length:var(--text-md)] font-normal transition duration-200 ease-[ease] hover:text-text-on-primary focus-visible:rounded-sm focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.3)] focus-visible:outline-none ${activeFilter === filter.id ? 'active border-accent font-medium text-accent' : 'text-white/70'}`}
                aria-pressed={activeFilter === filter.id}
                onClick={() => handleFilterClick(filter.id)}
              >
                {filter.name}
              </button>
            ))
          )}
        </div>

        <div className="products-grid mx-auto grid max-w-[1400px] grid-cols-3 justify-start gap-8 lg:grid-cols-2 lg:gap-6 max-[426px]:grid-cols-2 max-[426px]:gap-4">
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
            <div className="ui-state ui-state--empty home-products-empty col-[1/-1] mx-auto my-6 text-white/80">
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
      <section className="about-section overflow-hidden bg-primary-active p-0">
        <div className="about-container grid min-h-[500px] grid-cols-2">
          <div className="about-image relative w-[130%] overflow-hidden bg-primary-active max-md:w-[200%]">
            <img src="/images/banners/hero3.webp" alt="About Us" className="h-full w-full object-cover opacity-50 lg:w-[85%] max-md:w-full" />
            <div className="about-image-overlay absolute inset-0 z-[1] bg-[linear-gradient(304.14deg,var(--color-primary-active)_21.59%,rgba(18,14,77,0.4)_72.31%,var(--color-primary-active)_89.86%)]"></div>
          </div>
          <div className="about-content relative z-[2] flex flex-col justify-center py-12 pl-0 pr-16 text-text-on-primary max-md:-ml-[90%] max-md:py-10 max-md:pr-6">
            <div className="about-goggles-icon pointer-events-none absolute right-16 top-10 z-10 opacity-[0.13] max-md:hidden">
              <img src="/images/banners/spacs.webp" alt="Goggles" className="relative right-[-115px] top-5 h-auto w-[300px] rotate-[-13deg] brightness-0 invert" />
            </div>
            <h2 className="m-0 mb-5 text-[length:clamp(1.5rem,3vw,2rem)] font-medium tracking-[-0.02em] text-text-on-primary">About Us</h2>
            <p className="mb-5 text-[length:var(--text-md)] font-normal leading-[1.5] text-white/80">
              At Stallion, we specialize in providing high-quality safety goggles designed for industrial, corporate, and institutional use. Our focus is not retail sales, but long-term B2B partnerships with organizations that prioritize workforce safety and compliance.
            </p>
            <p className="mb-0 text-[length:var(--text-md)] font-normal leading-[1.5] text-white/80">
              With years of expertise in manufacturing and global distribution, we supply goggles that meet international safety standards such as ANSI, EN166, and ISI. From manufacturing plants and construction sites to laboratories and healthcare facilities, our products are trusted by industries worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Our B2B Advantage Section */}
      <section className="b2b-advantage-section bg-primary-active px-[6%] py-16 max-[426px]:px-5">
        <h2 className="b2b-advantage-title mb-12 text-center text-[length:clamp(2rem,4vw,3rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text-on-primary">Our B2B Advantage</h2>
        <div className="b2b-advantage-container mx-auto grid max-w-[1400px] grid-cols-3 gap-10 rounded-lg border border-white/10 bg-white/[0.04] p-10 lg:gap-6 lg:p-6 max-md:gap-6 max-[426px]:grid-cols-1">
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text-on-primary">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-white/[0.16] bg-white/[0.08] max-md:h-[60px] max-md:w-[60px]">
              <img src="/images/icons/package.webp" alt="Package" className="relative z-[1] h-[50px] w-[50px] object-contain brightness-0 invert max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text-on-primary lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Bulk Order Fulfilment</h3>
          </div>
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text-on-primary">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-white/[0.16] bg-white/[0.08] max-md:h-[60px] max-md:w-[60px]">
              <img src="/images/icons/bank-note-01.webp" alt="Bank Note" className="relative z-[1] h-[50px] w-[50px] object-contain brightness-0 invert max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text-on-primary lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Competitive Pricing</h3>
          </div>
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text-on-primary">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-white/[0.16] bg-white/[0.08] max-md:h-[60px] max-md:w-[60px]">
              <img src="/images/icons/globe-01.webp" alt="Globe" className="relative z-[1] h-[50px] w-[50px] object-contain brightness-0 invert max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text-on-primary lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Global Shipping</h3>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section bg-primary-active px-[6%] pb-16 pt-0 max-[426px]:px-5" id="faq-section">
        <h2 className="faq-title mb-12 text-center text-[length:clamp(2rem,4vw,3rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text-on-primary">FAQs</h2>
        <div className="faq-container mx-auto max-w-[1000px]">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item border-b border-white/[0.14]">
              <button
                type="button"
                className="faq-question group flex w-full cursor-pointer items-center justify-between gap-5 rounded-sm border-none bg-transparent py-6 text-left transition duration-200 ease-[ease] hover:bg-white/[0.03] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.3)] focus-visible:outline-none"
                aria-expanded={expandedFaq === index}
                aria-controls={`faq-answer-${index}`}
                onClick={() => toggleFaq(index)}
              >
                <span className="faq-question-content flex min-w-0 flex-1 items-center gap-8 max-[426px]:gap-3">
                  <span className="faq-number min-w-[40px] text-[length:var(--text-md)] font-normal text-white/50">{String(index + 1).padStart(2, '0')}</span>
                  <span className="faq-question-text text-[length:var(--text-lg)] font-medium text-text-on-primary max-[426px]:text-[length:var(--text-md)]">{faq.question}</span>
                </span>
                <span className={`faq-toggle flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-pill border text-[length:var(--text-xl)] leading-none transition duration-200 ease-[ease] ${expandedFaq === index ? 'border-accent bg-accent text-text-on-accent' : 'border-white/40 bg-transparent text-text-on-primary group-hover:border-white/60 group-hover:bg-white/10'}`} aria-hidden="true">
                  {expandedFaq === index ? '−' : '+'}
                </span>
              </button>
              {expandedFaq === index && (
                <div className="faq-answer pb-6 pl-[calc(40px+var(--space-8))] pr-0 pt-0 max-[426px]:pl-2" id={`faq-answer-${index}`} role="region">
                  <p className="m-0 text-[length:var(--text-md)] font-normal leading-[1.5] text-white/70 max-[426px]:text-[length:var(--text-base)]">{faq.answer}</p>
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

