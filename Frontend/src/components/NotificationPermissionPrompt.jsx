'use client';

import React, { useEffect, useState } from 'react';
import { FiBell } from './icons/hugeicons';
import { askPermission, isInstalledApp, shouldAskPermission, snoozeAsking } from '../utils/systemNotify';

// Asks to turn on notifications once the app is installed (or opened from the home screen).
// The browser only allows the question after a tap, so this is a small card with a button.
const NotificationPermissionPrompt = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => { if (isInstalledApp() && shouldAskPermission()) setOpen(true); };
    const t = setTimeout(check, 2500);
    const onInstalled = () => setTimeout(() => { if (shouldAskPermission()) setOpen(true); }, 1500);
    window.addEventListener('appinstalled', onInstalled);
    return () => { clearTimeout(t); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (!open) return null;

  const turnOn = async () => {
    await askPermission();
    setOpen(false);
  };
  const later = () => { snoozeAsking(7); setOpen(false); };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[2000] flex justify-center p-4"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      role="presentation"
    >
      <div
        className="w-full max-w-[420px] rounded-xl border border-border bg-surface p-4 shadow-lg"
        role="dialog"
        aria-labelledby="notify-ask-title"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-pill bg-surface-muted text-text">
            <FiBell size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="notify-ask-title" className="m-0 text-[length:var(--text-md)] font-semibold text-text">Turn on notifications</h2>
            <p className="mb-0 mt-1 text-[length:var(--text-sm)] text-text-muted">
              Get an alert on your phone for new tasks, orders and updates, even when Stallion is closed.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="ui-btn" onClick={later}>Not now</button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={turnOn}>Turn on</button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionPrompt;
