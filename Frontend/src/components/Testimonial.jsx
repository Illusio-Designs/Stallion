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
    <figure className="testimonial">
      <span className="testimonial-quote-mark" aria-hidden="true">&ldquo;</span>
      <blockquote className="testimonial-content">
        <p>{content}</p>
      </blockquote>
      <figcaption className="testimonial-author">
        <div className="author-image" aria-hidden={!image}>
          {image ? (
            <img src={image} alt={name} />
          ) : (
            <span className="author-initials">{getInitials(name)}</span>
          )}
        </div>
        <div className="author-info">
          <h4>{name}</h4>
          {role ? <p>{role}</p> : null}
        </div>
      </figcaption>
    </figure>
  );
};

export default Testimonial;
