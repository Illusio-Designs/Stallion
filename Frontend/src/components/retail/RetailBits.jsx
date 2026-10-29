'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/redesign-p-retail.css';
import '../../styles/dark-retail.css';
import '../../styles/pages/dashboard.css';
import '../../styles/redesign-p-forms.css';

// Small shared pieces for the Retail screens. Styles: styles/redesign-p-retail.css (dark: dark-retail.css).

/** A readable reason from any thrown value. */
export const errorText = (e, fallback = 'Something went wrong. Please try again.') => {
  const m = e && typeof e.message === 'string' ? e.message.trim() : '';
  if (!m) return fallback;
  if (/^failed to fetch$/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
  return m;
};

/**
 * Loads data when the page opens and again when `deps` change. A newer request wins, so a slow old answer
 * can never replace a newer one.
 */
export function useRetailLoad(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const run = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fetchRef.current();
      if (mine === seq.current) setState({ data, loading: false, error: '' });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ data: s.data, loading: false, error: errorText(e) }));
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ? <div className="page-head__actions">{children}</div> : null}
    </div>
  );
}

/** Error or empty state, same markup as the wholesale pages. */
export function StateBox({ kind = 'empty', title, desc, action = null }) {
  return (
    <div className={`dash-card ui-state ui-state--${kind}`}>
      <div className="ui-state__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40" aria-hidden="true">
          {kind === 'error'
            ? (<><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>)
            : (<><rect x="4" y="5" width="16" height="14" rx="2" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="13" y2="14" /></>)}
        </svg>
      </div>
      <p className="ui-state__title">{title}</p>
      {desc ? <p className="ui-state__desc">{desc}</p> : null}
      {action}
    </div>
  );
}

export function Kpi({ label, value, sub, loading = false }) {
  return (
    <div className="rt-kpi" role="listitem">
      <small>{label}</small>
      {loading ? <span className="ui-skeleton rt-kpi__skel" aria-hidden="true" /> : <b>{value}</b>}
      {sub ? <span className="rt-kpi__sub">{sub}</span> : null}
    </div>
  );
}

export function KpiRow({ children, label = 'Key figures' }) {
  return <div className="rt-kpis" role="list" aria-label={label}>{children}</div>;
}

export function Card({ title, hint, actions = null, children, className = '' }) {
  return (
    <section className={`rt-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="rt-card__head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {hint ? <p>{hint}</p> : null}
          </div>
          {actions ? <div className="rt-card__act">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

/** On / off switch, same look as the Offers and Manage switches. */
export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      className={`tgl rt-tgl${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  );
}

/** A labelled row with a switch on the right. */
export function SwitchRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="rt-switchrow">
      <div>
        <span className="rt-switchrow__l">{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

/** Pill chips (active = black). options: [{ value, label, count? }] */
export function Chips({ options, value, onChange, label }) {
  return (
    <div className="rt-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`rt-chip${value === o.value ? ' is-on' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && o.count !== null ? <b>{o.count}</b> : null}
        </button>
      ))}
    </div>
  );
}

/** Form field: label, control, optional hint. */
export function Field({ label, hint, full = false, children, htmlFor }) {
  return (
    <div className={`form-group${full ? ' rf-full' : ''}`}>
      {label ? <label className="ui-label" htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {hint ? <p className="rt-hint">{hint}</p> : null}
    </div>
  );
}

/** Frame photo or a neutral glasses placeholder. */
export function Thumb({ src, alt = '' }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="rt-thumb" src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />;
  }
  return (
    <span className="rt-thumb rt-thumb--empty" aria-hidden="true">
      <svg viewBox="0 0 120 50" fill="none"><circle cx="30" cy="26" r="15" stroke="currentColor" strokeWidth="5" /><circle cx="90" cy="26" r="15" stroke="currentColor" strokeWidth="5" /><path d="M45 24c8-5 22-5 30 0" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
    </span>
  );
}

/** Pill with a tone: ok (green), bad (red), mute (grey). Status only. */
export function Pill({ tone = 'mute', children }) {
  return <span className={`rt-pill rt-pill--${tone}`}>{children}</span>;
}

/** Comma-separated tags as removable chips: type and press Enter or comma. */
export function TagInput({ value = [], onChange, placeholder = 'Add a tag and press Enter', label = 'Tags' }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const parts = String(raw).split(',').map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    parts.forEach((p) => { if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p); });
    onChange(next);
    setText('');
  };
  return (
    <div className="rt-tags">
      {value.length > 0 && (
        <ul className="rt-tags__list" aria-label={label}>
          {value.map((t) => (
            <li key={t}>
              <span>{t}</span>
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="ui-input"
        value={text}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => { if (e.target.value.includes(',')) add(e.target.value); else setText(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(text); } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => add(text)}
      />
    </div>
  );
}
