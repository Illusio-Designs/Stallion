'use client';
import React from 'react';

/**
 * Top-level error boundary so a render error shows a recoverable fallback
 * instead of white-screening the whole SPA. componentDidCatch is the hook
 * for an external monitor (Sentry, etc.).
 *
 * Styles are inline on purpose so the fallback renders even if app CSS failed.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // TODO: forward to an error monitor (Sentry/Highlight) when wired.
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f4f5f7',
          fontFamily: "'Spoof Trial', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #ebecf0',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 8px 24px rgba(24, 18, 101, 0.10)',
          }}
        >
          <h1 style={{ fontSize: '20px', margin: '0 0 8px', color: '#1a1b23' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '14px', color: '#6b6f7d', margin: '0 0 20px', lineHeight: 1.5 }}>
            An unexpected error occurred. Reloading the page usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              minHeight: '40px',
              padding: '0 20px',
              background: '#181265',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
