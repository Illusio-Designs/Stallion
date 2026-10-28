import { describe, it, expect } from 'vitest';
import { istNow } from './istTime';

describe('istNow', () => {
  it('is YYYY-MM-DDTHH:mm and 30 minutes earlier works', () => {
    expect(istNow()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(istNow(30) < istNow() || istNow(30).slice(0, 10) < istNow().slice(0, 10)).toBe(true);
  });
  it('is Indian time, 5h30 ahead of UTC', () => {
    const [d, t] = istNow().split('T');
    const ist = Date.parse(`${d}T${t}:00Z`);
    expect(Math.abs(ist - (Date.now() + 5.5 * 3600000))).toBeLessThan(120000);
  });
});
