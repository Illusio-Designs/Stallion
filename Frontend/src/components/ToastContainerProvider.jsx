'use client';
import React from 'react';
import { ToastContainer } from 'react-toastify';
import '../styles/components/Toast.css';

const ToastContainerProvider = ({ children }) => {
  return (
    <>
      {children}
      <ToastContainer
        position="top-right"
        // Above the AsidePanel drawer (z-10050) and its dropdowns (z-99999) so
        // toasts/errors are never hidden behind an open panel.
        style={{ zIndex: 100001 }}
        autoClose={4000}
        limit={3}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        closeButton
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
};

export default ToastContainerProvider;

