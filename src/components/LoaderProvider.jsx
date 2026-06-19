'use client';
import React, { createContext, useContext } from 'react';

const LoaderContext = createContext();

export const useLoaderContext = () => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error('useLoaderContext must be used within a LoaderProvider');
  }
  return context;
};

const LoaderProvider = ({ children }) => {
  return <>{children}</>;
};

export default LoaderProvider;