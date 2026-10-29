'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { post } from '../lib/api';
import { sessionId } from '../lib/session';

// Cookie notice, Google Analytics and Meta pixel (IDs come from the admin settings), and our own visit ping.
export default function Tracker({ tracking = {} }) {
  const path = usePathname();
  const [consent, setConsent] = useState('unknown');

  useEffect(() => {
    let c = null;
    try { c = localStorage.getItem('stl-consent'); } catch (_e) { /* blocked */ }
    setConsent(c || (tracking.cookie_notice === false ? 'granted' : 'ask'));
  }, [tracking.cookie_notice]);

  useEffect(() => {
    // Remember the ad parameters of this tab session so checkout can attach them to the order.
    try {
      const q = new URLSearchParams(window.location.search);
      const u = {};
      ['source', 'medium', 'campaign', 'term', 'content'].forEach((k) => { const v = q.get('utm_' + k); if (v) u[k] = v; });
      if (Object.keys(u).length) sessionStorage.setItem('stl-utm', JSON.stringify(u));
    } catch (_e) { /* blocked */ }
  }, [path]);

  useEffect(() => {
    if (consent === 'unknown') return;
    let first = false;
    try { first = !sessionStorage.getItem('stl-visit'); if (first) sessionStorage.setItem('stl-visit', '1'); } catch (_e) { /* blocked */ }
    if (!first) return;
    const q = new URLSearchParams(window.location.search);
    post('/track/visit', {
      session_id: sessionId(), landing_page: path, referrer: document.referrer || null,
      utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'), utm_term: q.get('utm_term'), utm_content: q.get('utm_content'),
    }).catch(() => {});
  }, [consent, path]);

  const accept = (v) => { try { localStorage.setItem('stl-consent', v); } catch (_e) { /* blocked */ } setConsent(v); };
  const allowed = consent === 'granted';

  return (
    <>
      {allowed && tracking.ga_id ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.ga_id}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${tracking.ga_id}');`}</Script>
        </>
      ) : null}
      {allowed && tracking.meta_pixel_id ? (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.meta_pixel_id}');fbq('track','PageView');`}</Script>
      ) : null}
      {consent === 'ask' && (
        <div className="cookie" role="dialog" aria-label="Cookies">
          <div className="cookie__in">
            <span style={{ flex: '1 1 220px' }}>We use cookies to count visits and show relevant ads. You can say no.</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--sm" onClick={() => accept('denied')}>No thanks</button>
              <button type="button" className="btn btn--sm btn--pri" onClick={() => accept('granted')}>Accept</button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
