import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Breadcrumb from '../components/Breadcrumb';

const PublicLayout = ({ children, onPageChange, currentPage }) => {
  return (
    <div className="public-layout">
      <Header onPageChange={onPageChange} currentPage={currentPage} />
      <Breadcrumb currentPage={currentPage} onPageChange={onPageChange} />
      <main className="main-content page-enter" key={currentPage}>
        {children}
      </main>
      {/* Footer is desktop-only; on phones the header (Cart + Menu) is the only navigation. */}
      <div className="hidden md:block">
        <Footer onPageChange={onPageChange} />
      </div>
    </div>
  );
};

export default PublicLayout;
