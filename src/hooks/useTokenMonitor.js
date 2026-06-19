import { useEffect, useRef } from 'react';
import { isLoggedIn, logout } from '../services/authService';
import { showError } from '../services/notificationService';

/**
 * Hook to monitor token presence and automatically log out if token is removed
 * This handles cases where token is manually removed from localStorage
 */
export const useTokenMonitor = (isDashboard = false) => {
  const checkIntervalRef = useRef(null);
  const wasLoggedInRef = useRef(false);

  useEffect(() => {
    // Only monitor in dashboard pages
    if (!isDashboard || typeof window === 'undefined') {
      return;
    }

    // Initialize the logged in state
    wasLoggedInRef.current = isLoggedIn();

    // Function to check token presence
    const checkToken = () => {
      const currentlyLoggedIn = isLoggedIn();
      
      // If user was logged in but now token is missing, log them out
      // Only show notification if it hasn't been shown already
      if (wasLoggedInRef.current && !currentlyLoggedIn && !window.__hasShownLogoutNotification) {
        // Mark that we've shown the notification
        window.__hasShownLogoutNotification = true;
        
        // Token was removed - log out immediately
        showError('Your session has expired. Please login again.');
        logout();
        
        // Redirect to login page
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login')) {
          setTimeout(() => {
            window.location.href = '/login';
            setTimeout(() => {
              window.__hasShownLogoutNotification = false;
            }, 500);
          }, 100);
        } else {
          setTimeout(() => {
            window.__hasShownLogoutNotification = false;
          }, 500);
        }
        
        // Clear the interval since we're logging out
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      } else {
        // Update the reference
        wasLoggedInRef.current = currentlyLoggedIn;
      }
    };

    // Check immediately
    checkToken();

    // Set up interval to check more frequently (every 200ms for immediate detection)
    checkIntervalRef.current = setInterval(checkToken, 200);

    // Also listen for storage events (for cross-tab changes)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        checkToken();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Listen for custom authChange events
    const handleAuthChange = () => {
      checkToken();
    };

    window.addEventListener('authChange', handleAuthChange);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, [isDashboard]);
};
