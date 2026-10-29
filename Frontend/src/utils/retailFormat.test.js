import { describe, it, expect } from 'vitest';
import { rupees, istDateTime, slugify, lengthHint, TITLE_RANGE, DESC_RANGE, seoStatus, stepLabel, sentence, normalizeOrder, descriptionToText, textToDescription } from './retailFormat';

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
  it('reads the nested address and shipment of the order detail', () => {
    const o = normalizeOrder({ id: 'o1', order_number: 'WEB-1001', status: 'confirmed', allowed_next: ['packed'], customer: { name: 'Asha', phone: '98' }, address: { line1: '12 MG Road', line2: null, city: 'Pune', state: 'Maharashtra', pincode: '411001' }, shipment: { courier: 'Delhivery', awb: '123', tracking_url: 'https://t/1' } });
    expect(o.address_text).toBe('12 MG Road, Pune, Maharashtra, 411001');
    expect(o.courier).toBe('Delhivery');
    expect(o.awb).toBe('123');
    expect(o.tracking_url).toBe('https://t/1');
    expect(o.customer_name).toBe('Asha');
    expect(o.allowed_next).toEqual(['packed']);
  });
  it('still reads a flat list row', () => {
    const o = normalizeOrder({ id: 'o2', order_number: 'WEB-1002', customer_name: 'B', city: 'Pune', state: 'Karnataka', courier: 'X', awb: null });
    expect(o.city).toBe('Pune');
    expect(o.courier).toBe('X');
    expect(o.allowed_next).toBe(null);
  });
  it('turns a frame description into plain text and back', () => {
    expect(descriptionToText('<p>Tom &amp; Jerry</p><p>Line one<br>line two</p>')).toBe('Tom & Jerry\n\nLine one\nline two');
    expect(textToDescription('Tom & <b>Jerry</b>\n\nLine one\nline two')).toBe('<p>Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;</p><p>Line one<br>line two</p>');
    expect(textToDescription('  ')).toBe('');
    expect(descriptionToText(textToDescription('A & B\n\nC\nD'))).toBe('A & B\n\nC\nD');
  });
  it('names funnel steps', () => {
    expect(stepLabel('add_to_cart')).toBe('Added to cart');
    expect(stepLabel('something_new')).toBe('Something new');
    expect(sentence('out_for_delivery')).toBe('Out for delivery');
  });
});
