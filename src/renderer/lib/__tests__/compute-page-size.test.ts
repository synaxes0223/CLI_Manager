import { describe, it, expect } from 'vitest';
import { computePageSize } from '../compute-page-size';

describe('computePageSize', () => {
  it('returns 4 for a typical 1400×760 viewport with 2 cols', () => {
    // cellH = (1400/2)/2 = 350
    // maxRows = floor((760+6)/(350+6)) = floor(766/356) = 2
    // pageSize = 2*2 = 4
    expect(computePageSize(1400, 760, 2)).toBe(4);
  });

  it('enforces a minimum of 1 row (returns cols) for a tiny height', () => {
    expect(computePageSize(100, 5, 3)).toBe(3);
  });

  it('increases rows for a taller viewport', () => {
    // cellH = 350; maxRows = floor((1500+6)/(350+6)) = floor(1506/356) = 4
    expect(computePageSize(1400, 1500, 2)).toBe(8);
  });

  it('handles 3 columns', () => {
    // cellH = (1400/3)/2 ≈ 233.3
    // maxRows = floor((760+6)/(233.3+6)) = floor(766/239.3) = 3
    expect(computePageSize(1400, 760, 3)).toBe(9);
  });
});
