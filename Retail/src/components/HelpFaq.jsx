'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cleanHtml, looksLikeHtml, stripHtml } from '../lib/html';

// Category chips + client-side search over server-rendered FAQ groups (all answers are in the HTML for Google).
export default function HelpFaq({ groups = [] }) {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const view = useMemo(() => groups
    .filter((g) => cat === 'all' || g.category === cat)
    .map((g) => ({
      category: g.category,
      items: (g.items || []).filter((it) => !needle || `${it.question} ${stripHtml(it.answer)}`.toLowerCase().includes(needle)),
    }))
    .filter((g) => g.items.length), [groups, cat, needle]);
  const total = view.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="faq">
      <div className="field">
        <label htmlFor="faq-q" className="sr">Search the help articles</label>
        <input id="faq-q" type="search" className="input" placeholder="Search for an answer" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      {groups.length > 1 && (
        <div className="filters" role="group" aria-label="Topics">
          <button type="button" className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
          {groups.map((g) => (
            <button key={g.category} type="button" className="chip" aria-pressed={cat === g.category} onClick={() => setCat(g.category)}>{g.category}</button>
          ))}
        </div>
      )}
      <p className="sr" role="status" aria-live="polite">{total} {total === 1 ? 'answer' : 'answers'} shown</p>
      {view.length === 0 ? (
        <div className="box">
          <b>No answers match &ldquo;{q}&rdquo;</b>
          <p className="mute">Try a shorter word, or <Link href="/contact" className="lnk">ask us directly</Link>.</p>
        </div>
      ) : view.map((g) => (
        <section key={g.category} className="faq__grp">
          {(cat === 'all' && groups.length > 1) || needle ? <h2 className="faq__h">{g.category}</h2> : null}
          <div className="faq__list">
            {g.items.map((it) => (
              <details key={it.id || it.question}>
                <summary>{it.question}</summary>
                {looksLikeHtml(it.answer)
                  ? <div className="prose" dangerouslySetInnerHTML={{ __html: cleanHtml(it.answer) }} />
                  : <p>{it.answer}</p>}
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
