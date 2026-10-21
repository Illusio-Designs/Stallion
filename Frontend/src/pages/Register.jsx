import React from 'react';
import '../styles/pages/Register.css';

const Register = () => {
  return (
    <div className="register-page auth-split">
      <section className="auth-panel">
        <a href="/" className="auth-brand" aria-label="Stallion Eyewear home">
          <img src="/images/logo/logo.webp" alt="Stallion Eyewear" className="auth-brand-logo" />
        </a>
        <div className="auth-panel-main">
          <p className="auth-headline">Open a trade account.</p>
          <p className="auth-panel-text">Tell us about your shop. A manager approves the account and your salesman is assigned.</p>
        </div>
        <p className="auth-panel-foot">Salesmen, parties, distributors and the office team all sign in with a mobile number.</p>
      </section>
      <div className="register-content auth-form-side">
        <div className="register-container">
          <h1 className="register-title">Create your account</h1>
          <p className="register-subtitle">
            Registration is handled by your administrator. Please contact your team to be added,
            then sign in with your mobile number.
          </p>
          <a href="/login" className="register-signin ui-btn ui-btn--primary ui-btn--lg">Sign in</a>
        </div>
      </div>
    </div>
  );
};

export default Register;
