import React from 'react';

const AuthLayout = ({ children }) => {
  return (
    <div className="page-enter relative min-h-screen bg-surface-muted text-text">
      {children}
    </div>
  );
};

export default AuthLayout;
