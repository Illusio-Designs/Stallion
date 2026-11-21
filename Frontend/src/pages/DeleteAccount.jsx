import React from 'react';
import '../styles/pages/PrivacyPolicy.css';

const EMAIL = 'info@stallioneyewear.in';

const h2 = 'mt-8 mb-3 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tracking-[-0.005em] text-text scroll-mt-24';
const p = 'mb-5 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted';
const list = 'mb-5 list-disc pl-6 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted [&>li]:mb-2';
const olist = 'mb-5 list-decimal pl-6 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted [&>li]:mb-2';
const link = 'rounded-sm font-medium text-primary no-underline transition-colors duration-[120ms] hover:text-primary-hover hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]';

const accountMail = `mailto:${EMAIL}?subject=${encodeURIComponent('Account deletion request - Stallion Eyewear app')}&body=${encodeURIComponent('Registered phone number:\nFull name:\n\nPlease delete my Stallion Eyewear account and associated data.')}`;
const dataMail = `mailto:${EMAIL}?subject=${encodeURIComponent('Data deletion request - Stallion Eyewear app')}&body=${encodeURIComponent('Registered phone number:\nFull name:\n\nData I want deleted (e.g. profile photo, location history, expense receipts):\n')}`;

const DeleteAccount = () => {
  return (
    <div className="privacy-page bg-bg text-text">
      <section className="privacy-body px-5 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
        <div className="privacy-content mx-auto max-w-[720px]">
          <header className="privacy-header mb-8 border-b border-border pb-8">
            <p className="privacy-eyebrow mb-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Stallion Eyewear</p>
            <h1 className="mb-4 text-[length:var(--text-xl)] sm:text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">Delete your account or data</h1>
            <p className="privacy-lead text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">
              How users of the Stallion Eyewear app (by Stallion Eyewear) can request deletion of their account, or of specific data, and what happens to that data.
            </p>
          </header>

          <div className="privacy-prose">
            <h2 id="delete-account" className={`${h2} mt-0`}>Delete your account</h2>
            <ol className={olist}>
              <li>Send an email to <a className={link} href={accountMail}>{EMAIL}</a> from your registered email address, or include the phone number you use to sign in.</li>
              <li>Use the subject <strong>“Account deletion request”</strong> and include your full name and registered phone number.</li>
              <li>We may contact you on your registered phone number to confirm the request.</li>
              <li>Your account is deactivated immediately after confirmation and your data is deleted within <strong>30 days</strong>.</li>
            </ol>

            <h2 className={h2}>What is deleted</h2>
            <ul className={list}>
              <li>Profile details: name, phone number, email address, address and profile photo</li>
              <li>Location data recorded at check-ins and when placing orders</li>
              <li>Check-in records and uploaded expense receipt photos</li>
              <li>Your sign-in access to the app</li>
            </ul>

            <h2 className={h2}>What is kept, and for how long</h2>
            <ul className={list}>
              <li>Orders, invoices and payment/transaction records, including business details such as GSTIN and PAN, are kept for the period required under Indian tax and accounting law (GST), after which they are deleted.</li>
              <li>Records kept for these legal reasons are not used for any other purpose.</li>
            </ul>

            <h2 id="delete-data" className={h2}>Delete some of your data without deleting your account</h2>
            <p className={p}>You can ask us to delete specific data, such as your profile photo, location history from check-ins, or expense receipt photos, while keeping your account.</p>
            <ol className={olist}>
              <li>Email <a className={link} href={dataMail}>{EMAIL}</a> with the subject <strong>“Data deletion request”</strong>.</li>
              <li>Include your full name, registered phone number and the data you want deleted.</li>
              <li>We will confirm and complete the request within <strong>30 days</strong>. Data we must keep by law (see above) cannot be deleted early.</li>
            </ol>

            <h2 className={h2}>Contact</h2>
            <p className="mb-0 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">
              Questions about deletion? Email <a className={link} href={`mailto:${EMAIL}`}>{EMAIL}</a>. See also our <a className={link} href="/privacy-policy">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DeleteAccount;
