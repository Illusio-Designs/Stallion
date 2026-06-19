import React from 'react';

export default function NotFound() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginTop: '1rem' }}>Page Not Found</h2>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        The page you are looking for does not exist.
      </p>
      <a 
        href="/" 
        style={{ 
          marginTop: '2rem', 
          padding: '10px 20px', 
          backgroundColor: '#0070f3', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: '5px' 
        }}
      >
        Go back home
      </a>
    </div>
  );
}

