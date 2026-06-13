import React from 'react';
import '../styles/components/DashboardFooter.css';

const DashboardFooter = ({ isCollapsed }) => {
  return (
    <footer className={`dashboard-footer ${isCollapsed ? 'collapsed' : 'expanded'} sticky bottom-0 z-[4] mt-auto flex min-h-[54px] items-center border-t border-border bg-surface`}>
      <div className="dashboard-footer-content flex w-full items-center justify-center px-4 py-2 sm:px-5">
        <span className="dashboard-copyright text-center text-[length:var(--text-xs)] text-text-subtle">© 2024 Stallion Eyewear LLP. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default DashboardFooter;
