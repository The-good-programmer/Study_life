import { describe, expect, it } from 'vitest';
import { mergeIntervals, uncoveredMs } from './studyIntervals';

const MIN = 60_000;
const at = (minutes: number) => minutes * MIN;
const span = (from: number, to: number) => ({ start: at(from), end: at(to) });

describe('mergeIntervals', () => {
  it('joins overlapping and touching intervals, and drops empty ones', () => {
    expect(mergeIntervals([span(30, 40), span(0, 10), span(5, 20), span(20, 25), span(50, 50)])).toEqual([span(0, 25), span(30, 40)]);
  });
});

describe('uncoveredMs', () => {
  it('counts all of an interval with nothing before it', () => {
    expect(uncoveredMs([], span(0, 25))).toBe(at(25));
    expect(uncoveredMs([span(30, 40)], span(0, 25))).toBe(at(25));
  });

  it('counts nothing for an interval already covered', () => {
    expect(uncoveredMs([span(0, 25)], span(5, 15))).toBe(0);
  });

  it('counts only the part not covered', () => {
    // A 10-minute review that ends 5 minutes into a focus session.
    expect(uncoveredMs([span(-5, 5)], span(0, 25))).toBe(at(20));
  });

  it("doesn't count overlapping earlier intervals twice", () => {
    expect(uncoveredMs([span(0, 10), span(5, 15), span(20, 22)], span(0, 25))).toBe(at(8));
  });
});
