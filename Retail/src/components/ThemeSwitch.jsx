'use client';
import { useEffect, useState } from 'react';

const KEY = 'stl-retail-theme';
const apply = (choice) => {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const t = dark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.style.colorScheme = t;
};

// Light / Dark / System in one small cycle button.
export default function ThemeSwitch() {
  const [choice, setChoice] = useState('system');
  useEffect(() => {
    let c = 'system';
    try { c = localStorage.getItem(KEY) || 'system'; } catch (_e) { /* blocked */ }
    setChoice(c);
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSys = () => { try { if ((localStorage.getItem(KEY) || 'system') === 'system') apply('system'); } catch (_e) { /* ignore */ } };
    if (mq && mq.addEventListener) mq.addEventListener('change', onSys);
    return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', onSys); };
  }, []);
  const order = ['light', 'dark', 'system'];
  const next = () => {
    const n = order[(order.indexOf(choice) + 1) % order.length];
    setChoice(n);
    try { localStorage.setItem(KEY, n); } catch (_e) { /* blocked */ }
    apply(n);
  };
  const label = choice === 'light' ? 'Light' : choice === 'dark' ? 'Dark' : 'System';
  return (
    <button type="button" className="btn btn--sm" onClick={next} aria-label={`Theme: ${label}. Tap to change.`} title="Theme">
      {label}
    </button>
  );
}
