import { describe, it, expect } from 'vitest';
import { rupees, istDateTime, slugify, lengthHint, TITLE_RANGE, DESC_RANGE, seoStatus, stepLabel, sentence } from './retailFormat';

describe('retailFormat', () => {
  it('formats rupees', () => {
    expect(rupees(12500)).toBe('₹12,500');
    expect(rupees('1999.5')).toBe('₹1,999.5');
    expect(rupees(null)).toBe('—');
  });
  it('shows time in India, whatever the machine zone', () => {
    expect(istDateTime('2026-10-29T10:40:00Z')).toBe('29 Oct, 4:10 pm');
    expect(istDateTime('nope')).toBe('');
  });
  it('makes slugs', () => {
    expect(slugify('Black Square Frame & Co!')).toBe('black-square-frame-and-co');
    expect(slugify('  --Hello  World-- ')).toBe('hello-world');
  });
  it('checks title and description length', () => {
    expect(lengthHint('', TITLE_RANGE).label).toBe('Missing');
    expect(lengthHint('Short', TITLE_RANGE).label).toBe('Too short');
    expect(lengthHint('x'.repeat(45), TITLE_RANGE).label).toBe('Good');
    expect(lengthHint('x'.repeat(80), TITLE_RANGE).label).toBe('Too long');
    expect(lengthHint('x'.repeat(100), DESC_RANGE).tone).toBe('ok');
  });
  it('reports the worst of title and description', () => {
    expect(seoStatus('x'.repeat(45), 'x'.repeat(100)).tone).toBe('ok');
    expect(seoStatus('x'.repeat(45), '').label).toBe('Description: missing');
  });
  it('names funnel steps', () => {
    expect(stepLabel('add_to_cart')).toBe('Added to cart');
    expect(stepLabel('something_new')).toBe('Something new');
    expect(sentence('out_for_delivery')).toBe('Out for delivery');
  });
});
