'use client';
import React, { useEffect, useState } from 'react';
import '../styles/components/Toast.css';
import { setToasterLoader } from '../services/toastQueue';

// How long after the page appears the toaster is fetched when nobody has asked for a toast yet. The
// page's own scripts and data go first; the toaster comes once the connection is quiet.
const QUIET_MS = 3000;

// The toast library and its animation code are not in the first scripts: they are fetched once the
// page is up. It is a plain import() in an effect, not React.lazy or next/dynamic: lazy makes React
// hold back the whole page commit while it waits, and next/dynamic with ssr:false makes the page
// skip server rendering.

// One gooey toaster for the whole app (see services/notificationService.js).
const ToastContainerProvider = ({ children }) => {
  // Follow the resolved theme (data-theme on <html>) so toasts match light / dark.
  const [theme, setTheme] = useState('light');
  const [GooeyToaster, setGooeyToaster] = useState(null);
  useEffect(() => {
    let alive = true;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      import('./GooeyToasterHost').then((m) => { if (alive) setGooeyToaster(() => m.default); });
    };
    setToasterLoader(load); // a notification asked for earlier than QUIET_MS loads it at once
    const timer = setTimeout(load, QUIET_MS);
    return () => { alive = false; clearTimeout(timer); setToasterLoader(null); };
  }, []);
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
      {GooeyToaster && (
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
      )}
    </>
  );
};

export default ToastContainerProvider;
