'use client';

import React, { useEffect, useState } from 'react';
import { FiDownload, FiX, FiShare } from './icons/hugeicons';

// "Add to Home Screen" for the dashboard.
//  - Chrome / Edge / Android: the browser fires `beforeinstallprompt`; we keep it
//    and show the native install box when the button is pressed.
//  - iPad / iPhone Safari: there is no install API, so the button opens a short
//    guide (Share -> Add to Home Screen).
//  - Already installed (opened from the home screen): nothing is rendered.
const isStandalone = () =>
  typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true);

// iPadOS 13+ reports itself as a Mac, so also check for touch support.
const isIos = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const InstallAppButton = () => {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    setIos(isIos());

    const onPrompt = (e) => {
      e.preventDefault(); // keep it so our own button can trigger it
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setGuideOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Close the guide with Escape.
  useEffect(() => {
    if (!guideOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setGuideOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen]);

  if (!mounted || installed) return null;

  const handleClick = async () => {
    if (deferred) {
      try {
        deferred.prompt();
        await deferred.userChoice;
      } catch (_e) { /* the user closed the box or the browser refused */ }
      setDeferred(null);
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="dashboard-icon-btn install-app-btn inline-flex h-10 items-center justify-center gap-2 rounded-pill border-none bg-transparent px-2 text-text-muted transition duration-200 ease-[ease] hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.96] motion-reduce:transition-none lg:px-3"
        aria-label="Install app"
      >
        <FiDownload size={20} aria-hidden="true" />
        <span className="hidden text-[length:var(--text-sm)] font-medium lg:inline">Install app</span>
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="install-guide-title" className="m-0 text-[length:var(--text-md)] font-semibold text-text">
                Add Stallion to your home screen
              </h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border-none bg-transparent text-text-muted hover:bg-surface-muted hover:text-text"
                aria-label="Close"
              >
                <FiX size={18} aria-hidden="true" />
              </button>
            </div>

            {ios ? (
              <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[length:var(--text-base)] text-text">
                <li>
                  Tap the Share button <FiShare className="inline align-text-bottom" size={16} aria-hidden="true" /> in Safari
                  (top of the screen on iPad, bottom on iPhone).
                </li>
                <li>Scroll the list and tap <b>Add to Home Screen</b>.</li>
                <li>Tap <b>Add</b>. Stallion now opens full screen from your home screen.</li>
              </ol>
            ) : (
              <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[length:var(--text-base)] text-text">
                <li>Open your browser menu (the three dots).</li>
                <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                <li>Confirm. Stallion now opens full screen from your home screen.</li>
              </ol>
            )}

            <p className="mb-0 mt-3 text-[length:var(--text-xs)] text-text-muted">
              {ios
                ? 'On iPad and iPhone this only works in Safari. If you are in another browser, open this page in Safari first.'
                : 'If you do not see the option, this browser may not support installing apps.'}
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => setGuideOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
