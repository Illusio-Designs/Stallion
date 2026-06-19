import React from 'react';
import { FiInstagram, FiFacebook, FiLinkedin } from 'react-icons/fi';
import '../styles/components/Footer.css';

const Footer = ({ onPageChange }) => {
  return (
    <footer className="footer relative overflow-hidden bg-primary-active text-text-on-primary py-8 sm:py-10 lg:py-12">
      <div className="footer-background absolute top-0 left-0 w-full h-full z-[1] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:z-[2] after:bg-[linear-gradient(252.71deg,var(--color-primary-active)_-19.47%,rgba(24,18,101,0.7)_30.79%,var(--color-primary-active)_49.34%,var(--color-primary-active)_81.06%)]">
        <img src="/images/banners/background.webp" alt="Footer Background" className="footer-bg-image relative w-0 sm:w-[88%] h-auto object-cover left-[45%] top-[-45%]" />
      </div>
      <div className="footer-left-image absolute left-0 bottom-0 z-[2] opacity-30 pointer-events-none">
        <img src="/images/banners/spacs.webp" alt="Eyewear" className="footer-side-image relative h-auto object-contain opacity-40 [rotate:-25deg] w-[280px] left-[120px] top-[-120px] min-[385px]:w-[363px] min-[385px]:left-[134px] min-[385px]:top-[-82px] sm:w-[200px] sm:left-[54px] sm:top-[30px] md:w-[292px]" />
      </div>
      <div className="footer-content relative z-[3] max-w-[1280px] mx-auto grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] lg:grid-cols-[3fr_1fr_1fr] gap-8 lg:gap-12 py-5 px-6 min-[385px]:px-[5%]">
        <div className="footer-section footer-section--brand flex flex-col gap-0">
          <div className="footer-logo flex items-start">
            <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="footer-logo-image h-[70px] md:h-20 lg:h-[100px] w-auto object-contain" />
          </div>
        </div>
        <div className="footer-section flex flex-col gap-3">
          <h4 className="footer-heading m-0 mb-2 text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-white/60">Quick Links</h4>
          <ul className="footer-links list-none p-0 m-0 flex flex-col gap-1">
            <li><a href="/products" className="footer-link inline-flex items-center min-h-[32px] text-white/80 no-underline text-[length:var(--text-base)] leading-[var(--leading-normal)] rounded-sm transition-colors duration-[120ms] motion-reduce:transition-none hover:text-text-on-primary active:text-white/70 focus-visible:outline-none focus-visible:text-text-on-primary focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('products') : (window.location.href = '/products'); }}>Shop</a></li>
            <li><a href="/about" className="footer-link inline-flex items-center min-h-[32px] text-white/80 no-underline text-[length:var(--text-base)] leading-[var(--leading-normal)] rounded-sm transition-colors duration-[120ms] motion-reduce:transition-none hover:text-text-on-primary active:text-white/70 focus-visible:outline-none focus-visible:text-text-on-primary focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('about') : (window.location.href = '/about'); }}>About</a></li>
            <li><a href="/privacy-policy" className="footer-link inline-flex items-center min-h-[32px] text-white/80 no-underline text-[length:var(--text-base)] leading-[var(--leading-normal)] rounded-sm transition-colors duration-[120ms] motion-reduce:transition-none hover:text-text-on-primary active:text-white/70 focus-visible:outline-none focus-visible:text-text-on-primary focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('privacy-policy') : (window.location.href = '/privacy-policy'); }}>Privacy policy</a></li>
          </ul>
        </div>
        <div className="footer-section flex flex-col gap-3">
          <h4 className="footer-heading m-0 mb-2 text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-white/60">Contact and Support</h4>
          <p className="footer-text m-0 text-white/80 text-[length:var(--text-base)] leading-[var(--leading-normal)]"><a href="tel:+919324337504" className="footer-link footer-link--inline inline-flex items-center text-white/80 text-[length:var(--text-base)] leading-[var(--leading-normal)] rounded-sm transition-colors duration-[120ms] motion-reduce:transition-none no-underline hover:text-text-on-primary active:text-white/70 focus-visible:outline-none focus-visible:text-text-on-primary focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]">+91 93243 37504</a></p>
          <p className="footer-text m-0 text-white/80 text-[length:var(--text-base)] leading-[var(--leading-normal)]"><a href="mailto:info@stallioneyewear.in" className="footer-link footer-link--inline inline-flex items-center text-white/80 text-[length:var(--text-base)] leading-[var(--leading-normal)] rounded-sm transition-colors duration-[120ms] motion-reduce:transition-none underline underline-offset-2 decoration-white/40 hover:text-text-on-primary hover:decoration-white active:text-white/70 focus-visible:outline-none focus-visible:text-text-on-primary focus-visible:decoration-white focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]">info@stallioneyewear.in</a></p>
        </div>
      </div>
      <div className="footer-bottom relative z-[3] max-w-[1280px] mx-auto mt-20 border-t border-white/15 px-6 pt-6 min-[385px]:px-[5%] flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="footer-copyright m-0 text-[length:var(--text-xs)] text-white/65 text-center sm:text-left">© {new Date().getFullYear()} Stallion Eyewear LLP. All rights reserved.</p>
        <div className="footer-social flex items-center gap-1">
          <a href="#" aria-label="Instagram" className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-white/70 transition-colors duration-[120ms] hover:bg-white/10 hover:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]"><FiInstagram size={18} aria-hidden="true" /></a>
          <a href="#" aria-label="Facebook" className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-white/70 transition-colors duration-[120ms] hover:bg-white/10 hover:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]"><FiFacebook size={18} aria-hidden="true" /></a>
          <a href="#" aria-label="LinkedIn" className="inline-flex h-9 w-9 items-center justify-center rounded-pill text-white/70 transition-colors duration-[120ms] hover:bg-white/10 hover:text-text-on-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.35)]"><FiLinkedin size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
