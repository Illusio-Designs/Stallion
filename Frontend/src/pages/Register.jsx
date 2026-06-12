import React from 'react';
import '../styles/pages/Register.css';

const Register = () => {
  return (
    <div className="register-page">
      <div className="register-background" aria-hidden="true">
        <div className="register-gradient-overlay"></div>
      </div>
      <div className="register-content">
        <div className="register-container">
          <h1 className="register-title">Create your account</h1>
          <p className="register-subtitle">
            Registration is handled by your administrator. Please contact your team to be added,
            then sign in with your mobile number.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
