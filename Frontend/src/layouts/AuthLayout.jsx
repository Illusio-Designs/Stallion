import React from 'react';

const AuthLayout = ({ children }) => {
  return (
    <div
      className="page-enter"
      style={{
        minHeight: '100vh',
        position: 'relative',
        background: 'var(--color-surface-muted)',
        color: 'var(--color-text)',
      }}
    >
      {children}
    </div>
  );
};

export default AuthLayout;
