import React, { useMemo, useState } from 'react';
import KNOWN_ISSUES from '../data/knownIssues';

const SEVERITY = {
  1: { label: 'Very serious', badge: 'bg-error text-white', tile: 'text-error' },
  2: { label: 'Serious', badge: 'bg-error-soft text-error', tile: 'text-error' },
  3: { label: 'Medium', badge: 'bg-warning-soft text-warning', tile: 'text-warning' },
  4: { label: 'Small', badge: 'bg-surface-muted text-text-muted', tile: 'text-text-muted' },
};

const chip = (active) =>
  `rounded-full border px-3 py-1 text-[length:var(--text-xs)] font-medium transition focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
    active
      ? 'border-primary bg-primary text-white'
      : 'border-border-strong bg-surface text-text hover:bg-surface-muted'
  }`;

const DashboardKnownIssues = () => {
  const [sev, setSev] = useState('All');
  const [who, setWho] = useState('All');
  const [query, setQuery] = useState('');

  const people = useMemo(
    () => ['All', ...Array.from(new Set(KNOWN_ISSUES.flatMap((i) => i.affects)))],
    []
  );

  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
    KNOWN_ISSUES.forEach((i) => { c[i.severity] += 1; });
    return c;
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KNOWN_ISSUES.filter((i) =>
      (sev === 'All' || i.severity === sev)
      && (who === 'All' || i.affects.includes(who))
      && (!q || `${i.title} ${i.what} ${i.fix}`.toLowerCase().includes(q))
    );
  }, [sev, who, query]);

  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((i) => {
      if (!map.has(i.group)) map.set(i.group, []);
      map.get(i.group).push(i);
    });
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="dash-row">
          <div className="dash-card full p-5 min-[481px]:p-6">
            <h4 className="m-0 text-[var(--text-lg)] font-semibold leading-tight text-text">Known Problems</h4>
            <p className="mb-5 mt-2 text-[var(--text-sm)] leading-snug text-text-muted">
              Problems still open in the app, in simple words. {KNOWN_ISSUES.length} open.
            </p>

            <div className="mb-5 grid grid-cols-2 gap-3 min-[640px]:grid-cols-4">
              {[1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSev(sev === s ? 'All' : s)}
                  className={`rounded-lg border p-3 text-left transition focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                    sev === s ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-muted'
                  }`}
                >
                  <div className={`text-[length:var(--text-2xl,1.5rem)] font-semibold leading-none ${SEVERITY[s].tile}`}>{counts[s]}</div>
                  <div className="mt-1 text-[length:var(--text-xs)] text-text-muted">{SEVERITY[s].label}</div>
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-3">
              <input
                className="ui-input w-full"
                type="search"
                placeholder="Search problems…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search problems"
              />
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by who is affected">
                <span className="text-[length:var(--text-xs)] text-text-muted">Affects:</span>
                {people.map((p) => (
                  <button key={p} type="button" className={chip(who === p)} onClick={() => setWho(p)}>{p}</button>
                ))}
              </div>
            </div>

            {groups.length === 0 && (
              <p className="py-8 text-center text-[var(--text-sm)] text-text-muted">No problems match these filters.</p>
            )}

            {groups.map(([group, items]) => (
              <section key={group} className="mb-6 last:mb-0">
                <h5 className="mb-3 mt-0 text-[var(--text-sm)] font-semibold text-text">{group}</h5>
                <div className="flex flex-col gap-3">
                  {items.map((i) => (
                    <article key={i.title} className="rounded-lg border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h6 className="m-0 text-[var(--text-sm)] font-semibold text-text">{i.title}</h6>
                        <span className={`flex-none rounded-full px-2.5 py-0.5 text-[length:var(--text-xs)] font-medium ${SEVERITY[i.severity].badge}`}>
                          {SEVERITY[i.severity].label}
                        </span>
                      </div>
                      <p className="mb-2 mt-2 text-[var(--text-sm)] leading-snug text-text-muted">{i.what}</p>
                      <p className="m-0 text-[var(--text-sm)] leading-snug text-text">
                        <span className="font-medium text-success">What to do: </span>{i.fix}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {i.affects.map((a) => (
                          <span key={a} className="rounded-md bg-surface-muted px-2 py-0.5 text-[length:var(--text-xs)] text-text-muted">{a}</span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardKnownIssues;
