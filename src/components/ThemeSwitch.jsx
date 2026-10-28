'use client';

import React, { useEffect, useState } from 'react';
import { applyTheme, getThemeChoice, setThemeChoice } from '../utils/theme';

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

// Light / Dark / System. System follows the phone or computer and changes live.
const ThemeSwitch = ({ variant = 'segmented' }) => {
  const [choice, setChoice] = useState('system');

  useEffect(() => {
    setChoice(getThemeChoice());
    const onChange = (e) => setChoice(e.detail);
    window.addEventListener('stl-theme-change', onChange);
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onSystem = () => { if (getThemeChoice() === 'system') applyTheme('system'); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onSystem);
    return () => {
      window.removeEventListener('stl-theme-change', onChange);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onSystem);
    };
  }, []);

  return (
    <div className={`theme-switch theme-switch--${variant}`} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          className={`theme-switch__btn${choice === o.value ? ' is-on' : ''}`}
          onClick={() => setThemeChoice(o.value)}
        >
          {variant === 'cards' && <span className={`theme-switch__pv theme-switch__pv--${o.value}`} aria-hidden="true" />}
          {o.label}
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitch;
