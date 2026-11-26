import { describe, it, expect } from 'vitest';
import { isUpcoming, maxQuantity, clampQuantity, MAX_ORDER_QTY } from './upcoming';

describe('upcoming helpers', () => {
  it('reads the flag as boolean or 0/1', () => {
    expect(isUpcoming({ is_upcoming: true })).toBe(true);
    expect(isUpcoming({ is_upcoming: 1 })).toBe(true);
    expect(isUpcoming({ is_upcoming: '1' })).toBe(true);
    expect(isUpcoming({ is_upcoming: false })).toBe(false);
    expect(isUpcoming({ is_upcoming: 0 })).toBe(false);
    expect(isUpcoming({})).toBe(false);
    expect(isUpcoming(null)).toBe(false);
  });

  it('has no stock cap for upcoming products, only the sanity limit', () => {
    expect(maxQuantity({ is_upcoming: true }, 0)).toBe(MAX_ORDER_QTY);
    expect(clampQuantity(5000, { is_upcoming: true }, 0)).toBe(5000);
    expect(clampQuantity(10 * MAX_ORDER_QTY, { is_upcoming: true }, 3)).toBe(MAX_ORDER_QTY);
  });

  it('keeps the stock cap for normal products', () => {
    expect(maxQuantity({}, 7)).toBe(7);
    expect(clampQuantity(20, {}, 7)).toBe(7);
    expect(clampQuantity(0, {}, 7)).toBe(1);
    expect(clampQuantity(3, {}, 0)).toBe(0);
  });

  it('treats unknown stock as no cap', () => {
    expect(maxQuantity({}, null)).toBe(MAX_ORDER_QTY);
    expect(maxQuantity({}, undefined)).toBe(MAX_ORDER_QTY);
  });
});
