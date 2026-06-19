import React from 'react';
import '../styles/pages/PrivacyPolicy.css';

const PrivacyPolicy = () => {
  return (
    <div className="privacy-page bg-bg text-text">
      <section className="privacy-body px-5 pt-8 pb-12 sm:px-6 sm:pt-12 sm:pb-16">
        <div className="privacy-content mx-auto max-w-[720px]">
          <header className="privacy-header mb-8 border-b border-border pb-8">
            <p className="privacy-eyebrow mb-3 text-[length:var(--text-xs)] font-semibold uppercase tracking-[var(--tracking-label)] text-text-subtle">Legal</p>
            <h1 className="mb-4 text-[length:var(--text-xl)] sm:text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">Privacy Policy</h1>
            <p className="privacy-lead text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">
              We respect your privacy. This policy explains what data we collect, how we use it, and your choices.
            </p>
            <p className="privacy-meta mt-5 text-[length:var(--text-xs)] uppercase tracking-[var(--tracking-label)] text-text-subtle">Last updated June 12, 2026</p>
          </header>

          <div className="privacy-prose">
            <h2 className="mt-0 mb-3 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tracking-[-0.005em] text-text">Information We Collect</h2>
            <p className="mb-5 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">We collect information you provide directly (such as contact details) and technical data (such as device and usage information) to operate and improve our services.</p>

            <h2 className="mt-8 mb-3 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tracking-[-0.005em] text-text">How We Use Your Data</h2>
            <p className="mb-5 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">We use your data to fulfill orders, provide support, communicate updates, enhance product experience, and comply with legal obligations.</p>

            <h2 className="mt-8 mb-3 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tracking-[-0.005em] text-text">Your Rights</h2>
            <p className="mb-5 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">You may request access, correction, or deletion of your personal data where applicable. For requests, contact <a className="rounded-sm font-medium text-primary no-underline transition-colors duration-[120ms] hover:text-primary-hover hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]" href="mailto:info@stallioneyewear.in">info@stallioneyewear.in</a>.</p>

            <h2 className="mt-8 mb-3 text-[length:var(--text-lg)] font-semibold leading-[var(--leading-snug)] tracking-[-0.005em] text-text">Contact</h2>
            <p className="mb-0 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted">If you have any questions about this policy, contact us at <a className="rounded-sm font-medium text-primary no-underline transition-colors duration-[120ms] hover:text-primary-hover hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]" href="mailto:info@stallioneyewear.in">info@stallioneyewear.in</a>.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
