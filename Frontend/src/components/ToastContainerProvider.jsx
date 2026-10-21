'use client';
import React from 'react';
import { GooeyToaster } from 'goey-toast';
import 'goey-toast/styles.css';
import '../styles/components/Toast.css';

// One gooey toaster for the whole app (see services/notificationService.js).
const ToastContainerProvider = ({ children }) => {
  return (
    <>
      {children}
      <GooeyToaster
        position="top-right"
        theme="light"
        duration={4000}
        closeButton
        showProgress
        // Above the AsidePanel drawer (z-10050) and its dropdowns (z-99999) so
        // notifications are never hidden behind an open panel.
        toastOptions={{ style: { zIndex: 100001 } }}
      />
    </>
  );
};

export default ToastContainerProvider;
