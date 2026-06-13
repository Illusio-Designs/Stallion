import React from 'react';

const LoadingSpinner = ({ size = 40, color = '#181265' }) => {
  return (
    <div className="flex items-center justify-center w-full min-h-[200px] p-10">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <svg
        className="loading-spinner motion-reduce:[animation-duration:1.5s]"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="31.416"
          strokeDashoffset="31.416"
          fill="none"
          opacity="0.25"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="31.416"
          strokeDashoffset="23.562"
          fill="none"
        />
      </svg>
    </div>
  );
};

export default LoadingSpinner;
