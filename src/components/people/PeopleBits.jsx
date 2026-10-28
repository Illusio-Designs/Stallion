'use client';
import React, { useEffect, useState } from 'react';

// Small pieces shared by the Distributors and Office team pages.

export const initialOf = (name) => (String(name || '').trim()[0] || '?');

export const Avatar = ({ name }) => <span className="pp-av" aria-hidden="true">{initialOf(name)}</span>;

// One search box value, also driven by the header's global search.
export function usePeopleQuery() {
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handler = (e) => setQuery((e.detail?.query || '').trim());
    window.addEventListener('globalSearchChanged', handler);
    return () => window.removeEventListener('globalSearchChanged', handler);
  }, []);
  return [query, setQuery];
}

export const FormSection = ({ title, hint, children }) => (
  <section className="pp-sec">
    <div>
      <h3 className="pp-sec__h">{title}</h3>
      {hint ? <p className="pp-sec__d">{hint}</p> : null}
    </div>
    <div className="pp-grid">{children}</div>
  </section>
);
