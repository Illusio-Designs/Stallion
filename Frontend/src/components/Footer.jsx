import React from 'react';
import '../styles/components/Footer.css';

const Footer = ({ onPageChange }) => {
  return (
    <footer className="footer">
      <div className="footer-background">
        <img src="/images/banners/background.webp" alt="Footer Background" className="footer-bg-image" />
      </div>
      <div className="footer-left-image">
        <img src="/images/banners/spacs.webp" alt="Eyewear" className="footer-side-image" />
      </div>
      <div className="footer-content">
        <div className="footer-section footer-section--brand">
          <div className="footer-logo">
            <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="footer-logo-image" />
          </div>
        </div>
        <div className="footer-section">
          <h4 className="footer-heading">Quick Links</h4>
          <ul className="footer-links">
            <li><a href="/products" className="footer-link" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('products') : (window.location.href = '/products'); }}>Shop</a></li>
            <li><a href="/about" className="footer-link" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('about') : (window.location.href = '/about'); }}>About</a></li>
            <li><a href="/privacy-policy" className="footer-link" onClick={e => { e.preventDefault(); onPageChange ? onPageChange('privacy-policy') : (window.location.href = '/privacy-policy'); }}>Privacy policy</a></li>
          </ul>
        </div>
        <div className="footer-section">
          <h4 className="footer-heading">Contact and Support</h4>
          <p className="footer-text">+1 (800) 123-4567</p>
          <p className="footer-text"><a href="mailto:support@stallion.com" className="footer-link footer-link--inline">support@stallion.com</a></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
