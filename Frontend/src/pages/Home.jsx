import React, { useState, useEffect } from 'react';
import '../styles/pages/Home.css';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/ui/Skeleton';
import { getFeaturedProducts, getCollections } from '../services/apiService';
import { isLoggedIn } from '../services/authService';
import { productPath } from '../utils/dashboardRoutes';
import { FiPackage, FiCreditCard, FiGlobe } from 'react-icons/fi';

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
      answer: "We typically supply bulk orders starting from 500 units, though it varies by frame or collection."
    },
    {
      question: "Do you offer bulk pricing or distributor discounts?",
      answer: "Yes, we provide competitive pricing for bulk orders and special discounts for distributors."
    },
    {
      question: "Can we order private-label or custom-branded frames?",
      answer: "Yes — we offer private labelling, custom branding and packaging on bulk orders."
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
      <div className="hero-section relative flex min-h-[calc(100vh+200px)] flex-col items-center justify-center overflow-hidden bg-surface pb-16 pt-[var(--header-height)] mt-[calc(var(--header-height)*-1)]">
        <div className="hero-background hidden">
          <img src="/images/banners/hero background.webp" alt="Hero Background" className="hero-bg-image block h-full w-full object-cover" />
        </div>
        <div className="hero-left-image hidden pointer-events-none absolute left-0 top-2/5 z-[2] -translate-y-1/2">
          <img src="/images/banners/spacs.webp" alt="Eyewear" className="hero-side-image relative left-[-33px] h-auto w-[200px] rotate-[-20deg] object-contain opacity-[0.18] lg:w-[160px] lg:left-[-16px] max-[426px]:w-[140px]" />
        </div>
        <div className="hero-content relative z-[2] box-border w-full max-w-[900px] px-5 pb-16 pt-[calc(var(--header-height)+var(--space-8))] text-center text-text lg:max-w-[760px] lg:px-5 lg:pb-12 lg:pt-16">
          <h1 className="mb-5 text-[length:clamp(2rem,5vw,3.5rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text">Wholesale Sunglasses &amp; Frames For Retailers &amp; Opticians</h1>
          <p className="mx-auto mb-8 max-w-[680px] text-[length:clamp(1rem,2vw,1.25rem)] leading-[1.5] text-text-muted">Premium sunglasses and optical frames, supplied in bulk to retailers, opticians and distributors — with competitive wholesale pricing and reliable supply.</p>
          <button
            type="button"
            className="cta-button inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-md bg-accent px-8 py-3 text-[length:var(--text-md)] font-semibold tracking-[0.02em] text-text-on-accent shadow-sm transition duration-200 ease-[ease] hover:bg-accent-hover hover:shadow-md focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none active:scale-[0.98]"
            onClick={() => onPageChange ? onPageChange('products') : (window.location.href = '/products')}
          >
            Shop Now
          </button>
        </div>
        <div className="banner-slider relative w-full overflow-hidden bg-surface pb-10">
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


      {/* About Us Section */}
      <section className="about-section overflow-hidden bg-surface p-0">
        <div className="about-container grid min-h-[360px] grid-cols-2">
          <div className="about-image relative w-[130%] overflow-hidden bg-surface max-md:w-[200%]">
            <img src="/images/banners/hero3.webp" alt="About Us" className="h-full w-full object-cover opacity-50 lg:w-[85%] max-md:w-full" />
            <div className="about-image-overlay absolute inset-0 z-[1] bg-[linear-gradient(304.14deg,var(--color-surface)_21.59%,rgba(255,255,255,0.35)_72.31%,var(--color-surface)_89.86%)]"></div>
          </div>
          <div className="about-content relative z-[2] flex flex-col justify-center py-10 pl-0 pr-16 text-text max-md:-ml-[90%] max-md:py-8 max-md:pr-6">
            <div className="about-goggles-icon pointer-events-none absolute right-16 top-10 z-10 opacity-[0.13] max-md:hidden">
              <img src="/images/banners/spacs.webp" alt="Eyewear" className="relative right-[-115px] top-5 h-auto w-[300px] rotate-[-13deg] brightness-0 invert" />
            </div>
            <h2 className="m-0 mb-5 text-[length:clamp(1.5rem,3vw,2rem)] font-medium tracking-[-0.02em] text-text">About Us</h2>
            <p className="mb-5 text-[length:var(--text-md)] font-normal leading-[1.5] text-text-muted">
              At Stallion, we specialize in premium sunglasses and optical frames for retailers, opticians and distributors. Our focus is long-term B2B partnerships — supplying on-trend eyewear at wholesale scale with competitive pricing and dependable service.
            </p>
            <p className="mb-0 text-[length:var(--text-md)] font-normal leading-[1.5] text-text-muted">
              With years of expertise in eyewear manufacturing and global distribution, we supply sunglasses and frames crafted from quality acetate and metal, with UV-protective lenses and on-trend designs. From optical stores and boutiques to retail chains and online sellers, our collections are trusted by retailers worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Our B2B Advantage Section */}
      <section className="b2b-advantage-section bg-surface px-[6%] py-16 max-[426px]:px-5">
        <h2 className="b2b-advantage-title mb-12 text-center text-[length:clamp(2rem,4vw,3rem)] font-medium leading-[1.2] tracking-[-0.02em] text-text">Our B2B Advantage</h2>
        <div className="b2b-advantage-container mx-auto grid max-w-[1400px] grid-cols-3 gap-10 rounded-lg border border-border bg-grey-50 p-10 lg:gap-6 lg:p-6 max-md:gap-6 max-[426px]:grid-cols-1">
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-border bg-grey-100 max-md:h-[60px] max-md:w-[60px]">
              <FiPackage aria-hidden="true" className="relative z-[1] h-[50px] w-[50px] max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Bulk Order Fulfilment</h3>
          </div>
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-border bg-grey-100 max-md:h-[60px] max-md:w-[60px]">
              <FiCreditCard aria-hidden="true" className="relative z-[1] h-[50px] w-[50px] max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Competitive Pricing</h3>
          </div>
          <div className="b2b-advantage-card flex flex-col items-center text-center text-text">
            <div className="b2b-icon relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-pill border border-border bg-grey-100 max-md:h-[60px] max-md:w-[60px]">
              <FiGlobe aria-hidden="true" className="relative z-[1] h-[50px] w-[50px] max-md:h-[30px] max-md:w-[30px]" />
            </div>
            <h3 className="m-0 text-[length:var(--text-lg)] font-medium text-text lg:text-[length:var(--text-md)] max-[384px]:text-[length:var(--text-base)]">Global Shipping</h3>
          </div>
        </div>
      </section>


    </div>
  );
};

export default Home;

