'use client';
import React, { useEffect, useState } from 'react';
import { GooeyToaster } from 'goey-toast';
import 'goey-toast/styles.css';
import '../styles/components/Toast.css';

// One gooey toaster for the whole app (see services/notificationService.js).
const ToastContainerProvider = ({ children }) => {
  // Follow the resolved theme (data-theme on <html>) so toasts match light / dark.
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return (
    <>
      {children}
      <GooeyToaster
        position="top-right"
        theme={theme}
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
