import { describe, it, expect, beforeEach } from 'vitest';
import * as cart from './cartService';

describe('cartService', () => {
  beforeEach(() => {
    cart.clearCart();
  });

  it('adds items and counts total quantity', () => {
    cart.addToCart({ id: '1', quantity: 2 });
    cart.addToCart({ id: '2', quantity: 3 });
    expect(cart.getCartCount()).toBe(5);
  });

  it('updates the quantity of an existing item', () => {
    cart.addToCart({ id: '1', quantity: 1 });
    cart.updateCartQuantity('1', 4);
    expect(cart.getCartCount()).toBe(4);
    expect(cart.getCartItems()).toHaveLength(1);
  });

  it('removes an item', () => {
    cart.addToCart({ id: '1', quantity: 1 });
    cart.addToCart({ id: '2', quantity: 1 });
    cart.removeFromCart('1');
    expect(cart.getCartItems().map((i) => i.id)).toEqual(['2']);
  });

  it('re-adding an existing id replaces its quantity (no duplicates)', () => {
    cart.addToCart({ id: '1', quantity: 1 });
    cart.addToCart({ id: '1', quantity: 5 });
    expect(cart.getCartItems()).toHaveLength(1);
    expect(cart.getCartCount()).toBe(5);
  });

  it('notifies registered listeners on change', () => {
    let calls = 0;
    const unsubscribe = cart.registerCartListener(() => { calls += 1; });
    cart.addToCart({ id: '1', quantity: 1 });
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
  });
});
