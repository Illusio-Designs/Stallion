import React from 'react';
import '../styles/components/Loader.css';

const Loader = ({ isLoading = true }) => {
  if (!isLoading) return null;

  return (
    <div className="loader-overlay fixed inset-0 w-screen h-screen flex justify-center items-center z-[9999]">
      <div className="loader-container flex flex-col items-center gap-5">
        <div className="loader-icon relative flex justify-center items-center w-[130px] h-[130px] sm:w-[150px] sm:h-[150px] md:w-[180px] md:h-[180px]">
          <div className="loader-arc loader-arc-1 absolute border-4 border-solid border-transparent rounded-pill z-[1] w-[110px] h-[110px] sm:w-[130px] sm:h-[130px] md:w-[160px] md:h-[160px]"></div>
          <div className="loader-arc loader-arc-2 absolute border-4 border-solid border-transparent rounded-pill z-[1] w-[85px] h-[85px] sm:w-[100px] sm:h-[100px] md:w-[120px] md:h-[120px]"></div>
          <img
            src="/faviconnotbg.png"
            alt="Loading..."
            className="loader-image relative z-10 object-contain w-[60px] h-[60px] sm:w-[70px] sm:h-[70px] md:w-20 md:h-20 [filter:brightness(1.2)]"
          />
        </div>
        <div className="loader-text text-text-on-primary text-[length:var(--text-md)] font-semibold tracking-[var(--tracking-label)] uppercase">LOADING</div>
      </div>
    </div>
  );
};

export default Loader;
