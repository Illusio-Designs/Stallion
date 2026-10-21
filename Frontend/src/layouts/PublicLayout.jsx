import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';
import MobileBottomNav from '../components/MobileBottomNav';

const PublicLayout = ({ children, onPageChange, currentPage }) => {
  return (
    <div className="public-layout">
      <Header onPageChange={onPageChange} currentPage={currentPage} />
      <Breadcrumb currentPage={currentPage} onPageChange={onPageChange} />
      <main className="main-content page-enter" key={currentPage}>
        {children}
      </main>
      {/* Footer is desktop-only; on mobile the floating bottom nav replaces it. */}
      <div className="hidden md:block">
        <Footer onPageChange={onPageChange} />
      </div>
      {/* Bottom room on mobile so the floating nav never covers page content. */}
      <div className="md:hidden h-[calc(84px+env(safe-area-inset-bottom))]" aria-hidden="true" />
      <MobileBottomNav onPageChange={onPageChange} currentPage={currentPage} />
    </div>
  );
};

export default PublicLayout;
