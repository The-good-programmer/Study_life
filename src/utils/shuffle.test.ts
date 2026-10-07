import { describe, it, expect } from 'vitest';
import { shuffle } from './shuffle';

/** Small seeded PRNG (mulberry32) so statistical tests are repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...shuffle(input)].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input and returns a new array', () => {
    const input = [1, 2, 3];
    const out = shuffle(input);
    expect(input).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['a'])).toEqual(['a']);
  });

  it('is deterministic for a given random source', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], seeded(42));
    const b = shuffle([1, 2, 3, 4, 5, 6], seeded(42));
    expect(a).toEqual(b);
  });

  it('is uniform: every item lands in every position about equally often', () => {
    const size = 4;
    const runs = 24000;
    const random = seeded(7);
    const counts = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < runs; r++) {
      shuffle([0, 1, 2, 3], random).forEach((item, position) => counts[item][position]++);
    }
    const expected = runs / size;
    counts.flat().forEach(count => expect(Math.abs(count - expected) / expected).toBeLessThan(0.06));
  });
});
