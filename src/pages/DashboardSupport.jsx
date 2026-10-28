import React, { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import { FiSearch } from '../components/icons/hugeicons';
import { showSuccess, showError } from '../services/notificationService';
import { getUser } from '../services/authService';
import '../styles/pages/dashboard-support.css';
import '../styles/redesign-p-account.css';

const ANSWERS = [
  { q: 'I did not get my code', a: 'Wait 30 seconds, then tap Resend. You can resend 3 times in 15 minutes.' },
  { q: 'I cannot place a visit order', a: 'You must be within 50 m of the shop. The first visit to a shop allows 150 m and saves the exact spot. A party with no location needs its address picked in Party \u2192 Edit first.' },
  { q: 'A page says Access denied', a: 'Your role cannot change that data. Ask an admin.' },
];

// Name and email come from the signed-in user, so the person only writes the question.
const readSender = () => {
  let u = null;
  try { u = getUser(); } catch { u = null; }
  let stored = {};
  try { stored = JSON.parse(window.localStorage.getItem('user') || '{}') || {}; } catch { stored = {}; }
  let storedName = '';
  try { storedName = window.localStorage.getItem('userName') || ''; } catch { storedName = ''; }
  return {
    name: (u && (u.full_name || u.name)) || stored.name || storedName || '',
    email: (u && u.email) || stored.email || '',
  };
};

const DashboardSupport = () => {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? ANSWERS.filter((x) => `${x.q} ${x.a}`.toLowerCase().includes(s)) : ANSWERS;
  }, [search]);

  const handleSend = (e) => {
    e.preventDefault();
    const { name, email } = readSender();
    if (!query.trim()) {
      showError('Please write your question.');
      return;
    }
    try {
      const who = name || email || 'a Stallion user';
      const subject = encodeURIComponent(`Support Query from ${who}`);
      const body = encodeURIComponent(`Name: ${name || '-'}\nEmail: ${email || '-'}\n\nMessage:\n${query}`);
      const mailto = `mailto:illusiodesigns@gmail.com?subject=${subject}&body=${body}`;
      window.location.href = mailto;
      showSuccess('Opening your email client to send the message...');
    } catch (_) {
      showError('Could not open email client.');
    }
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="pg-head"><div><h1>Support</h1><p>Find an answer or send a question to the Stallion team.</p></div></div>
        <div className="acc-support">
          <section className="dash-card acc-card" aria-labelledby="sup-answers">
            <h2 id="sup-answers" className="acc-h">Quick answers</h2>
            <label className="acc-search">
              <FiSearch size={18} aria-hidden="true" />
              <input type="search" className="ui-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the answers" aria-label="Search the answers" />
            </label>
            {shown.length ? (
              <dl className="acc-faq">
                {shown.map((x) => (
                  <div className="acc-faq__item" key={x.q}>
                    <dt>{x.q}</dt>
                    <dd>{x.a}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="acc-empty">No answer matches "{search}". Write to us on this page and we will help.</p>
            )}
          </section>

          <section className="dash-card acc-card" aria-labelledby="sup-contact">
            <h2 id="sup-contact" className="acc-h">Still stuck? Write to us</h2>
            <form onSubmit={handleSend} className="ui-form acc-form">
              <div className="acc-field">
                <label className="ui-label" htmlFor="support-query">Your question</label>
                <textarea id="support-query" className="ui-input acc-textarea" rows={5} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Write your question here..." required />
              </div>
              <div className="acc-row-end">
                <span className="acc-hint">Your name and email are added for you.</span>
                <Button type="submit">Send</Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardSupport;
