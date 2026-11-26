import { describe, it, expect } from 'vitest';
import { searchScore, searchRows } from './search';

const rows = [['Raj Optical', 'Mumbai'], ['Pratik Optical', 'Surat'], ['Sapna Optics', 'Pune']];
const names = (q) => searchRows(rows, q, (r) => r).map((r) => r[0]);

describe('search', () => {
  it('finds part of a word', () => { expect(names('prati')).toEqual(['Pratik Optical']); });
  it('ignores spaces and case', () => {
    expect(names('rajopti')).toEqual(['Raj Optical']);
    expect(names('PRATIK  op')).toEqual(['Pratik Optical']);
  });
  it('takes words in any order', () => { expect(names('optical raj')).toEqual(['Raj Optical']); });
  it('forgives one wrong letter', () => { expect(names('pratek')).toEqual(['Pratik Optical']); });
  it('matches city and ranks word starts first', () => {
    expect(names('surat')).toEqual(['Pratik Optical']);
    expect(names('opt')[0]).toBeDefined();
  });
  it('returns nothing for unrelated text and everything for empty', () => {
    expect(names('zzzz')).toEqual([]);
    expect(names('')).toHaveLength(3);
    expect(searchScore('', ['x'])).toBe(1);
  });
});
