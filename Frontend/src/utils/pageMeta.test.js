import { describe, it, expect } from 'vitest';
import { metadataForSlug } from './pageMeta';

describe('pageMeta', () => {
  it('builds product detail title from model_no', () => {
    expect(metadataForSlug(['product', 'MAS-MYSTIC-C2']).title).toContain('MAS-MYSTIC-C2');
  });

  it('decodes an encoded model_no', () => {
    expect(metadataForSlug(['product', 'A%20B']).title).toContain('A B');
  });

  it('titles the shop page', () => {
    expect(metadataForSlug(['products']).title).toContain('Shop');
  });

  it('marks private pages noindex', () => {
    expect(metadataForSlug(['dashboard']).robots).toEqual({ index: false, follow: false });
    expect(metadataForSlug(['login']).robots).toEqual({ index: false, follow: false });
  });

  it('leaves public pages indexable', () => {
    expect(metadataForSlug(['products']).robots).toBeUndefined();
    expect(metadataForSlug(['about']).robots).toBeUndefined();
  });

  it('always includes OpenGraph', () => {
    const m = metadataForSlug(['about']);
    expect(m.openGraph.title).toBe(m.title);
  });
});
