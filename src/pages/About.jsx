import React from 'react';
import { FiBox, FiTag, FiGlobe, FiTool, FiTruck, FiUsers } from 'react-icons/fi';
import '../styles/pages/About.css';

const About = () => {
  return (
    <div className="about-page bg-bg text-text">
      {/* Hero */}
      <section className="about-hero relative overflow-hidden bg-primary py-12 px-5 md:py-16">
        <div className="about-hero-bg absolute inset-0 z-[1]">
          <img
            src="/images/banners/hero1.webp"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-[50%_20%] opacity-[0.28]"
          />
          <div className="about-hero-overlay absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(18,14,77,0.55)_0%,rgba(24,18,101,0.75)_100%)]" />
        </div>
        <div className="about-hero-content container relative z-[3] max-w-[760px] mx-auto text-center">
          <p className="about-eyebrow text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-white/70 m-0 mb-3">
            About Stallion
          </p>
          <h1 className="text-[length:var(--text-xl)] md:text-[length:var(--text-2xl)] leading-[var(--leading-tight)] tracking-[-0.02em] font-bold text-text-on-primary m-0 mb-4">
            Certified safety eyewear, supplied at scale
          </h1>
          <p className="about-hero-lede text-[length:var(--text-md)] leading-[var(--leading-normal)] text-white/[0.82] max-w-[620px] mx-auto">
            We are a B2B-first brand supplying certified safety eyewear at scale to
            enterprises, factories, institutions, and government bodies.
          </p>
        </div>
      </section>

      {/* Story + Mission */}
      <section className="about-intro py-12 sm:py-16 bg-bg">
        <div className="container about-intro-grid grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="about-intro-content max-w-[60ch]">
            <p className="about-eyebrow about-eyebrow--dark text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle m-0 mb-3">
              Our mission
            </p>
            <h2 className="text-[length:var(--text-xl)] md:text-[length:var(--text-2xl)] leading-[var(--leading-tight)] tracking-[-0.02em] font-bold text-text m-0 mb-4">
              Built for safety. Delivered for scale.
            </h2>
            <p className="text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted m-0 mb-4">
              At Stallion, our focus is enterprise-grade safety. We design and
              manufacture safety goggles that meet international standards like
              ANSI, EN166, and ISI, enabling organizations to protect their
              workforce without compromise.
            </p>
            <p className="text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted m-0">
              From heavy industries and construction to laboratories and
              healthcare, our eyewear is engineered for performance, comfort,
              and reliability in demanding environments.
            </p>
            <div className="about-highlights flex flex-wrap gap-3 mt-6">
              <div className="highlight flex-[1_1_100%] sm:flex-none flex items-center gap-2 bg-surface border border-border py-2 px-4 rounded-pill min-h-[40px] shadow-xs">
                <FiBox className="highlight-icon w-[18px] h-[18px] text-primary shrink-0" aria-hidden="true" />
                <span className="text-[length:var(--text-base)] text-text font-medium">High-volume fulfilment</span>
              </div>
              <div className="highlight flex-[1_1_100%] sm:flex-none flex items-center gap-2 bg-surface border border-border py-2 px-4 rounded-pill min-h-[40px] shadow-xs">
                <FiTag className="highlight-icon w-[18px] h-[18px] text-primary shrink-0" aria-hidden="true" />
                <span className="text-[length:var(--text-base)] text-text font-medium">Enterprise pricing</span>
              </div>
              <div className="highlight flex-[1_1_100%] sm:flex-none flex items-center gap-2 bg-surface border border-border py-2 px-4 rounded-pill min-h-[40px] shadow-xs">
                <FiGlobe className="highlight-icon w-[18px] h-[18px] text-primary shrink-0" aria-hidden="true" />
                <span className="text-[length:var(--text-base)] text-text font-medium">Global shipping</span>
              </div>
            </div>
          </div>
          <div className="about-intro-image order-first md:order-none relative overflow-hidden rounded-lg border border-border shadow-sm aspect-[4/3]">
            <img
              src="/images/banners/hero4.webp"
              alt="Enterprise safety eyewear in use"
              className="w-full h-full object-cover block"
            />
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="about-certifications bg-surface-muted py-12 sm:py-16">
        <div className="certifications-container container max-w-[720px] mx-auto text-center">
          <p className="about-eyebrow about-eyebrow--dark text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle m-0 mb-3">
            Standards
          </p>
          <h2 className="text-[length:var(--text-xl)] md:text-[length:var(--text-2xl)] leading-[var(--leading-tight)] tracking-[-0.02em] font-bold text-text m-0 mb-4">
            Certifications
          </h2>
          <p className="about-section-lede text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text-muted max-w-[60ch] mx-auto mb-8">
            Our products are tested and compliant with the most widely accepted
            safety benchmarks.
          </p>
          <div className="certifications-grid flex flex-wrap gap-3 justify-center">
            <div className="cert-badge py-3 px-6 border border-border bg-surface text-primary rounded-md text-[length:var(--text-base)] font-semibold tracking-[0.02em] shadow-xs">ANSI</div>
            <div className="cert-badge py-3 px-6 border border-border bg-surface text-primary rounded-md text-[length:var(--text-base)] font-semibold tracking-[0.02em] shadow-xs">EN166</div>
            <div className="cert-badge py-3 px-6 border border-border bg-surface text-primary rounded-md text-[length:var(--text-base)] font-semibold tracking-[0.02em] shadow-xs">ISI</div>
          </div>
        </div>
      </section>

      {/* Why Choose Stallion */}
      <section className="about-why bg-bg py-12 sm:py-16">
        <div className="container">
          <p className="about-eyebrow about-eyebrow--dark text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle m-0 mb-3">
            Why Stallion
          </p>
          <h2 className="text-[length:var(--text-xl)] md:text-[length:var(--text-2xl)] leading-[var(--leading-tight)] tracking-[-0.02em] font-bold text-text m-0 mb-4">
            Built for demanding environments
          </h2>
          <div className="why-grid grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mt-8">
            <div className="why-card bg-surface rounded-lg p-6 border border-border shadow-sm">
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Industrial-grade quality</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Impact-resistant lenses, anti-fog options, and a comfortable fit for all-day use.</p>
            </div>
            <div className="why-card bg-surface rounded-lg p-6 border border-border shadow-sm">
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Reliable supply chain</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Consistent production capacity and on-time delivery for bulk orders.</p>
            </div>
            <div className="why-card bg-surface rounded-lg p-6 border border-border shadow-sm">
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Customization</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Logo printing, packaging, and specification-based configurations available.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="about-team bg-surface-muted py-12 sm:py-16">
        <div className="container">
          <p className="about-eyebrow about-eyebrow--dark text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] uppercase text-text-subtle m-0 mb-3">
            Our people
          </p>
          <h2 className="text-[length:var(--text-xl)] md:text-[length:var(--text-2xl)] leading-[var(--leading-tight)] tracking-[-0.02em] font-bold text-text m-0 mb-4">
            Leadership and operations
          </h2>
          <div className="team-grid grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 mt-8">
            <div className="team-member text-center bg-surface py-8 px-6 rounded-lg border border-border shadow-sm">
              <div className="team-avatar w-[56px] h-[56px] rounded-pill mx-auto mb-4 bg-primary-soft flex items-center justify-center"><FiTool className="team-avatar-icon w-6 h-6 text-primary" aria-hidden="true" /></div>
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Manufacturing lead</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Oversees production quality and compliance.</p>
            </div>
            <div className="team-member text-center bg-surface py-8 px-6 rounded-lg border border-border shadow-sm">
              <div className="team-avatar w-[56px] h-[56px] rounded-pill mx-auto mb-4 bg-primary-soft flex items-center justify-center"><FiTruck className="team-avatar-icon w-6 h-6 text-primary" aria-hidden="true" /></div>
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Supply chain head</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Ensures reliable delivery for global orders.</p>
            </div>
            <div className="team-member text-center bg-surface py-8 px-6 rounded-lg border border-border shadow-sm">
              <div className="team-avatar w-[56px] h-[56px] rounded-pill mx-auto mb-4 bg-primary-soft flex items-center justify-center"><FiUsers className="team-avatar-icon w-6 h-6 text-primary" aria-hidden="true" /></div>
              <h3 className="text-[length:var(--text-md)] leading-[var(--leading-snug)] font-semibold text-text m-0 mb-2">Enterprise success</h3>
              <p className="text-[length:var(--text-base)] leading-[var(--leading-normal)] text-text-muted m-0">Drives long-term partnerships and support.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
