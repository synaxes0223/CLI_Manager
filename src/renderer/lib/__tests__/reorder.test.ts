import { describe, it, expect } from 'vitest';
import { reorder } from '../reorder';

describe('reorder', () => {
  it('moves an item forward', () => {
    expect(reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });
  it('moves an item backward', () => {
    expect(reorder([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3]);
  });
  it('returns the same reference when indices are equal', () => {
    const arr = [1, 2, 3];
    expect(reorder(arr, 1, 1)).toBe(arr);
  });
  it('handles a two-element swap', () => {
    expect(reorder(['a', 'b'], 0, 1)).toEqual(['b', 'a']);
  });
});
