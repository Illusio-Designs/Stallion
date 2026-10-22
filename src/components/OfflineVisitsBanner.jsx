import React, { useEffect, useState } from 'react';
import { getQueue, subscribeQueue, removeQueued } from '../services/offlineQueue';
import { sendWaitingVisits } from '../hooks/useOfflineSync';

// Shows visits that are saved on this phone and not sent yet, with a way to send now.
const OfflineVisitsBanner = () => {
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(getQueue());
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    const off = subscribeQueue(setItems);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { off(); window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const waiting = items.filter((i) => i.status === 'waiting');
  const failed = items.filter((i) => i.status === 'failed');
  if (!waiting.length && !failed.length && online) return null;
  if (!waiting.length && !failed.length) {
    return <div className="offline-banner offline-banner--off" role="status">You are offline. A visit you save will be kept on this phone and sent when the signal returns.</div>;
  }

  return (
    <div className="offline-banner" role="status">
      {waiting.length > 0 && (
        <div className="offline-banner__row">
          <span>
            {waiting.length === 1 ? '1 visit is saved on this phone' : `${waiting.length} visits are saved on this phone`}
            {online ? ' and will be sent now.' : ' and will be sent when you are online.'}
          </span>
          {online && (
            <button type="button" className="offline-banner__btn" disabled={busy} onClick={async () => { setBusy(true); try { await sendWaitingVisits(); } finally { setBusy(false); } }}>
              {busy ? 'Sending…' : 'Send now'}
            </button>
          )}
        </div>
      )}
      {failed.map((i) => (
        <div className="offline-banner__row offline-banner__row--bad" key={i.id}>
          <span>Not sent: {i.error}</span>
          <button type="button" className="offline-banner__btn" onClick={() => removeQueued(i.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};

export default OfflineVisitsBanner;
