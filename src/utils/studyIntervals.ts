/** A stretch of study time, in epoch milliseconds. */
export interface StudyInterval {
  start: number;
  end: number;
}

/** The intervals joined where they overlap or touch, in order. Empty or backwards ones are dropped. */
export function mergeIntervals(intervals: readonly StudyInterval[]): StudyInterval[] {
  const sorted = intervals.filter(i => i.end > i.start).sort((a, b) => a.start - b.start);
  const merged: StudyInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/**
 * How much of `next` isn't already covered by `existing`, in ms. Used so that time spent
 * reviewing during a focus session (or focusing during a review) counts once, not twice.
 */
export function uncoveredMs(existing: readonly StudyInterval[], next: StudyInterval): number {
  const length = Math.max(0, next.end - next.start);
  let covered = 0;
  for (const interval of mergeIntervals(existing)) {
    covered += Math.max(0, Math.min(interval.end, next.end) - Math.max(interval.start, next.start));
  }
  return Math.max(0, length - covered);
}
