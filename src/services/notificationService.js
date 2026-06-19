import { toast } from 'react-toastify';

// Theme colors
const themeColors = {
  primary: '#181265',
  success: '#181265',
  error: '#ff4444',
  warning: '#b25e00',
  info: '#181265'
};

// Icons for notifications
const SuccessIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#181265" strokeWidth="2" fill="none"/>
    <path d="M8 12L11 15L16 9" stroke="#181265" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ErrorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#ff4444" strokeWidth="2" fill="none"/>
    <path d="M12 8V12" stroke="#ff4444" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 16H12.01" stroke="#ff4444" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#181265" strokeWidth="2" fill="none"/>
    <path d="M12 16V12" stroke="#181265" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="8" r="1" fill="#181265"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 22H22L12 2Z" stroke="#b25e00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M12 9V13" stroke="#b25e00" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 17H12.01" stroke="#b25e00" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const CartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V17C17 18.1 17.9 19 19 19C20.1 19 21 18.1 21 17V13M9 19.5C9.8 19.5 10.5 20.2 10.5 21C10.5 21.8 9.8 22.5 9 22.5C8.2 22.5 7.5 21.8 7.5 21C7.5 20.2 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21C21.5 21.8 20.8 22.5 20 22.5C19.2 22.5 18.5 21.8 18.5 21C18.5 20.2 19.2 19.5 20 19.5Z" stroke="#181265" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Toast configuration
const toastConfig = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  style: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderLeft: '4px solid',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  }
};

// Success notification
export const showSuccess = (message, icon = null) => {
  toast.success(message, {
    ...toastConfig,
    icon: icon || <SuccessIcon />,
    style: {
      ...toastConfig.style,
      borderLeftColor: themeColors.success,
    }
  });
};

// Error notification
export const showError = (message, icon = null) => {
  toast.error(message, {
    ...toastConfig,
    icon: icon || <ErrorIcon />,
    style: {
      ...toastConfig.style,
      borderLeftColor: themeColors.error,
    }
  });
};

// Info notification
export const showInfo = (message, icon = null) => {
  toast.info(message, {
    ...toastConfig,
    icon: icon || <InfoIcon />,
    style: {
      ...toastConfig.style,
      borderLeftColor: themeColors.info,
    }
  });
};

// Warning notification
export const showWarning = (message, icon = null) => {
  toast.warning(message, {
    ...toastConfig,
    icon: icon || <WarningIcon />,
    style: {
      ...toastConfig.style,
      borderLeftColor: themeColors.warning,
    }
  });
};

// Login success
export const showLoginSuccess = () => {
  showSuccess('Login successful! Welcome back.');
};

// Logout success
export const showLogoutSuccess = () => {
  showInfo('Logged out successfully.');
};

// Add to cart success
export const showAddToCartSuccess = (productName, quantity) => {
  showSuccess(`${productName} added to cart (Qty: ${quantity})`, <CartIcon />);
};

// Remove from cart success
export const showRemoveFromCartSuccess = (productName) => {
  showInfo(`${productName} removed from cart`, <CartIcon />);
};

// Update cart quantity success
export const showCartUpdateSuccess = (productName, quantity) => {
  showInfo(`${productName} quantity updated to ${quantity}`, <CartIcon />);
};

// Place order success
export const showPlaceOrderSuccess = () => {
  showSuccess('Order placed successfully! Thank you for your purchase.');
};

