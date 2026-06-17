import React, { useState } from 'react';
import Button from '../components/ui/Button';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard-support.css';

const DashboardSupport = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!name || !email || !query) {
      showError('Please fill out all fields.');
      return;
    }
    try {
      const subject = encodeURIComponent(`Support Query from ${name}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${query}`);
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
        <div className="dash-row">
          <div className="dash-card full support p-5 min-[481px]:p-6">
            <div className="support-header flex items-end justify-between gap-4 mb-5 min-[481px]:mb-6">
              <div>
                <h4 className="support-title m-0 text-[var(--text-lg)] leading-tight tracking-[-0.01em] font-semibold text-text">Contact Support</h4>
                <p className="support-subtitle mt-2 mb-0 text-text-muted text-[var(--text-sm)] leading-snug">Send us your query and we will get back to you.</p>
              </div>
            </div>

            <form onSubmit={handleSend} className="ui-form support-form grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 min-[560px]:gap-5">
              <div className="form-group flex flex-col gap-2">
                <label className="ui-label block mb-2" htmlFor="support-name">Your Name</label>
                <input id="support-name" className="ui-input w-full" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" required />
              </div>
              <div className="form-group flex flex-col gap-2">
                <label className="ui-label block mb-2" htmlFor="support-email">Email</label>
                <input id="support-email" className="ui-input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="form-group flex flex-col gap-2 col-[1/-1]">
                <label className="ui-label block mb-2" htmlFor="support-query">Query</label>
                <textarea id="support-query" className="ui-input w-full min-h-[140px] resize-y" rows={6} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Write your question here..." required />
              </div>

              <div className="support-form-actions flex flex-wrap justify-end gap-3 col-[1/-1]">
                <Button type="submit">Send</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSupport;

