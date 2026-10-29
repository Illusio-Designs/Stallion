import { describe, it, expect } from 'vitest';
import { statusChoices, nextStatus } from './retailOrderStatus';

describe('retailOrderStatus', () => {
  it('offers only what the server allows', () => {
    const allowed = ['packed', 'dispatched', 'cancelled'];
    expect(statusChoices('confirmed', allowed).map((o) => o.value)).toEqual(['packed', 'dispatched', 'cancelled']);
    expect(statusChoices('delivered', ['returned']).map((o) => o.value)).toEqual(['returned']);
    expect(statusChoices('cancelled', []).length).toBe(0);
  });
  it('offers every other status when the server sent no list', () => {
    expect(statusChoices('pending').length).toBe(7);
  });
  it('picks the next step, or the first allowed forward step', () => {
    expect(nextStatus('pending')).toBe('confirmed');
    expect(nextStatus('pending', ['packed', 'cancelled'])).toBe('packed');
    expect(nextStatus('delivered', ['returned'])).toBe(null);
    expect(nextStatus('cancelled', [])).toBe(null);
  });
});
