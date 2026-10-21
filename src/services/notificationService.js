import { gooeyToast } from 'goey-toast';

// Icons for notifications
const CartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V17C17 18.1 17.9 19 19 19C20.1 19 21 18.1 21 17V13M9 19.5C9.8 19.5 10.5 20.2 10.5 21C10.5 21.8 9.8 22.5 9 22.5C8.2 22.5 7.5 21.8 7.5 21C7.5 20.2 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21C21.5 21.8 20.8 22.5 20 22.5C19.2 22.5 18.5 21.8 18.5 21C18.5 20.2 19.2 19.5 20 19.5Z" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Notifications use goey-toast: the toast morphs out of a small pill into a soft
// blob, shows the message, then folds back. <GooeyToaster /> is mounted once in
// ToastContainerProvider. Every notification in the app goes through these helpers.
const DURATION = 4000;
const text = (message) => (typeof message === 'string' ? message : String(message ?? ''));
const opts = (icon) => ({ duration: DURATION, ...(icon ? { icon } : {}) });

// Success notification
export const showSuccess = (message, icon = null) => {
  gooeyToast.success(text(message), opts(icon));
};

// Error notification
export const showError = (message, icon = null) => {
  gooeyToast.error(text(message), opts(icon));
};

// Info notification
export const showInfo = (message, icon = null) => {
  gooeyToast.info(text(message), opts(icon));
};

// Warning notification
export const showWarning = (message, icon = null) => {
  gooeyToast.warning(text(message), opts(icon));
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

