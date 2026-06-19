// Cart Service - Shared state management for cart
const CART_STORAGE_KEY = 'stallion_cart_items';
let cartItems = [];
let cartListeners = [];

// localStorage only exists in the browser. This module is imported during SSR
// (via Header -> cartService), so guard every access behind a window check.
const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

// Load cart items from localStorage
const loadCartFromStorage = () => {
  if (!hasStorage()) {
    cartItems = [];
    return;
  }
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      cartItems = JSON.parse(stored);
    } else {
      cartItems = [];
    }
  } catch (error) {
    console.error('Error loading cart from storage:', error);
    cartItems = [];
  }
};

// Save cart items to localStorage
const saveCartToStorage = () => {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

// Initialize cart from storage (no-op on the server; rehydrated in the browser).
loadCartFromStorage();

// Get cart items
export const getCartItems = () => cartItems;

// Get cart count
export const getCartCount = () => {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
};

// Add item to cart
export const addToCart = (product) => {
  const existingItem = cartItems.find(item => item.id === product.id);
  
  if (existingItem) {
    // Update quantity if item already exists
    existingItem.quantity = product.quantity;
  } else {
    // Add new item
    cartItems.push({ ...product });
  }
  
  saveCartToStorage();
  notifyListeners();
};

// Remove item from cart
export const removeFromCart = (productId) => {
  cartItems = cartItems.filter(item => item.id !== productId);
  saveCartToStorage();
  notifyListeners();
};

// Update quantity
export const updateCartQuantity = (productId, quantity) => {
  const item = cartItems.find(item => item.id === productId);
  if (item) {
    item.quantity = quantity;
    // Create a new array reference to trigger React re-render
    cartItems = [...cartItems];
    saveCartToStorage();
    notifyListeners();
  }
};

// Clear cart
export const clearCart = () => {
  cartItems = [];
  saveCartToStorage();
  notifyListeners();
};

// Register listener for cart changes
export const registerCartListener = (listener) => {
  cartListeners.push(listener);
  return () => {
    cartListeners = cartListeners.filter(l => l !== listener);
  };
};

// Notify all listeners
const notifyListeners = () => {
  cartListeners.forEach(listener => listener());
};

