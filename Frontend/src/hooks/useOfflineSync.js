import { useEffect } from 'react';
import { flushQueue, getQueue } from '../services/offlineQueue';
import { createSalesmanCheckin } from '../services/api/salesmanApi';
import { showSuccess, showError } from '../services/notificationService';

// Keeps trying to send visits that were saved offline: when the phone comes back online,
// when the app opens, and every 30 seconds while something is waiting.
export const sendWaitingVisits = async () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (!getQueue().some((i) => i.status === 'waiting')) return;
  const { sent, failed } = await flushQueue(createSalesmanCheckin);
  if (sent) showSuccess(sent === 1 ? '1 saved visit was sent' : `${sent} saved visits were sent`);
  if (failed) showError(failed === 1 ? '1 saved visit was refused. Open the banner to see why.' : `${failed} saved visits were refused. Open the banner to see why.`);
};

export const useOfflineSync = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    sendWaitingVisits();
    const onOnline = () => { sendWaitingVisits(); };
    window.addEventListener('online', onOnline);
    const timer = setInterval(sendWaitingVisits, 30000);
    return () => { window.removeEventListener('online', onOnline); clearInterval(timer); };
  }, []);
};
