import React from 'react';
import '@/styles/components/Testimonial.css';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const Testimonial = ({ name, role, content, image }) => {
  return (
    <figure className="testimonial relative m-0 flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm transition duration-300 ease-[ease] hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none sm:p-8">
      <span
        className="testimonial-quote-mark pointer-events-none absolute right-6 top-4 select-none text-[length:var(--text-2xl)] font-bold leading-none text-primary-soft-hover"
        aria-hidden="true"
      >
        &ldquo;
      </span>
      <blockquote className="testimonial-content m-0 flex-1">
        <p className="m-0 text-[length:var(--text-md)] leading-[var(--leading-normal)] text-text">{content}</p>
      </blockquote>
      <figcaption className="testimonial-author flex items-center gap-4">
        <div
          className="author-image flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-primary-soft"
          aria-hidden={!image}
        >
          {image ? (
            <img src={image} alt={name} className="size-full object-cover" />
          ) : (
            <span className="author-initials text-[length:var(--text-base)] font-semibold tracking-[var(--tracking-label)] text-primary">
              {getInitials(name)}
            </span>
          )}
        </div>
        <div className="author-info">
          <h4 className="mb-1 mt-0 text-[length:var(--text-base)] font-semibold leading-[var(--leading-snug)] text-text">
            {name}
          </h4>
          {role ? (
            <p className="m-0 text-[length:var(--text-sm)] leading-[var(--leading-snug)] text-text-muted">{role}</p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
};

export default Testimonial;
