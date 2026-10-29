'use client';
import { useState } from 'react';
import { post } from '../lib/api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(?:\+?91)?[6-9]\d{9}$/;

function validate(v) {
  const e = {};
  if (v.name.trim().length < 2) e.name = 'Please enter your name.';
  const c = v.contact.trim();
  if (!c) e.contact = 'Enter a phone number or an email so we can reply.';
  else if (!EMAIL.test(c) && !PHONE.test(c.replace(/[\s-]/g, ''))) e.contact = 'Enter a valid 10 digit mobile number or an email address.';
  if (v.message.trim().length < 10) e.message = 'Tell us a little more (at least 10 characters).';
  return e;
}

export default function ContactForm() {
  const [v, setV] = useState({ name: '', contact: '', message: '' });
  const [touched, setTouched] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done
  const [fail, setFail] = useState('');
  const errors = validate(v);
  const show = (k) => (touched[k] ? errors[k] : '');
  const set = (k) => (ev) => setV((o) => ({ ...o, [k]: ev.target.value }));
  const blur = (k) => () => setTouched((o) => ({ ...o, [k]: true }));

  async function submit(ev) {
    ev.preventDefault();
    setTouched({ name: true, contact: true, message: true });
    setFail('');
    if (Object.keys(errors).length) return;
    setState('sending');
    try {
      await post('/contact', { name: v.name.trim(), contact: v.contact.trim(), message: v.message.trim() });
      setState('done');
    } catch (err) {
      setFail(err.message || 'We could not send your message. Please try again or use WhatsApp.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className="box ct__done" role="status">
        <h2 style={{ fontSize: 20 }}>Thanks, we have your message</h2>
        <p className="mute">We reply within one working day. For anything urgent, WhatsApp is fastest.</p>
        <button type="button" className="btn" onClick={() => { setV({ name: '', contact: '', message: '' }); setTouched({}); setState('idle'); }}>Send another message</button>
      </div>
    );
  }

  const field = (k, label, el) => (
    <div className="field">
      <label htmlFor={`ct-${k}`}><span>{label}</span></label>
      {el}
      {show(k) ? <span className="err" id={`ct-${k}-err`}>{show(k)}</span> : null}
    </div>
  );
  const common = (k) => ({ id: `ct-${k}`, className: 'input', value: v[k], onChange: set(k), onBlur: blur(k), 'aria-invalid': show(k) ? 'true' : undefined, 'aria-describedby': show(k) ? `ct-${k}-err` : undefined });

  return (
    <form className="box" onSubmit={submit} noValidate>
      <h2 style={{ fontSize: 18 }}>Send a message</h2>
      {field('name', 'Name', <input {...common('name')} autoComplete="name" placeholder="Your name" maxLength={80} />)}
      {field('contact', 'Phone or email', <input {...common('contact')} autoComplete="email" placeholder="How can we reach you" maxLength={120} />)}
      {field('message', 'Message', <textarea {...common('message')} placeholder="What do you need help with?" maxLength={2000} rows={5} />)}
      {fail ? <p className="err" role="alert">{fail}</p> : null}
      <button type="submit" className="btn btn--pri" disabled={state === 'sending'}>{state === 'sending' ? 'Sending...' : 'Send message'}</button>
    </form>
  );
}
