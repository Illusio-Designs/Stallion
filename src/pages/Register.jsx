import React from 'react';
import '../styles/pages/Register.css';

const Register = () => {
  return (
    <div className="register-page relative flex min-h-screen flex-col bg-primary-active">
      <div className="register-background absolute inset-0 z-0" aria-hidden="true">
        <div className="register-gradient-overlay absolute inset-0 bg-[linear-gradient(160deg,var(--color-primary)_0%,var(--color-primary-active)_100%)]"></div>
      </div>
      <div className="register-content relative z-[1] flex flex-1 items-center justify-center px-4 py-8 md:py-12">
        <div className="register-container w-full max-w-[480px] rounded-lg border border-border bg-surface px-5 py-6 shadow-lg sm:px-6 sm:py-8 md:px-8 md:py-10">
          <h1 className="register-title m-0 mb-2 text-center text-[length:var(--text-xl)] font-bold leading-[var(--leading-tight)] tracking-[-0.01em] text-text sm:text-[length:var(--text-2xl)]">Create your account</h1>
          <p className="register-subtitle m-0 text-center text-[length:var(--text-base)] font-normal leading-[var(--leading-normal)] text-text-muted">
            Registration is handled by your administrator. Please contact your team to be added,
            then sign in with your mobile number.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
